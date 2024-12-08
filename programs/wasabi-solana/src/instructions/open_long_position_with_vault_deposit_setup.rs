use {
    super::OpenLongPositionCleanup,
    crate::{
        WithdrawTrait,
        error::ErrorCode, long_pool_signer_seeds, lp_vault_signer_seeds,
        utils::{position_setup_transaction_introspection_validation, calculate_shares_to_burn, transfer_borrow_amount_from_vault, approve_authority_delegation}, BasePool, DebtController,
        GlobalSettings, LpVault, OpenPositionRequest, Permission, Position, SwapCache
    },
    anchor_lang::{prelude::*, solana_program::sysvar},
    anchor_spl::{
        token_interface::{
            self, Approve, Mint, TokenAccount, TokenInterface, TransferChecked, Burn,
        },
        token_2022::{Token2022},
        token::Token,
    },
};

#[derive(Accounts)]
#[instruction(nonce: u16)]
pub struct OpenLongWithVaultDepositSetup<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = shares_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_2022::ID
    )]
    pub owner_shares_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        has_one = vault,
    )]
    pub src_lp_vault: Box<InterfaceAccount<'info, LpVault>>,

    #[account(mut)]
    pub src_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        has_one = vault
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,

    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        has_one = collateral_vault,
        has_one = currency_vault,
    )]
    pub pool: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub currency_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency: Box<InterfaceAccount<'info, Mint>>,
    pub shares_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = owner,
        seeds = [b"open_pos", owner.key().as_ref()]
        bump,
        space = 8 + std::mem::size_of::<OpenPositionRequest>()
    )]
    pub open_position_request: Box<Account<'info, OpenPositionRequest>>,

    #[account(
        init,
        payer = owner,
        seeds = [
            b"postiion",
            owner.key().as_ref(),
            lp_vault.key().as_ref(),
            &nonce.to_le_bytes(),
        ],
        bump,
        space = 8 + std::mem:size_of::<Position>(),
    )]
    pub position: Box<Account<'info, Position>>,

    pub authority: Signer<'info>,

    #[account(
        has_one = authority
    )]
    pub permission: Box<Account<'info, Permission>>,

    #[account(
        mut,
        constraint = fee_wallet.owner == global_settings.fee_wallet
    )]
    pub fee_wallet: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [b"debt_controller"],
        bump
    )]
    pub debt_controller: Box<Account<'info, DebtController>>,

    #[account(
        seeds = [b"global_settings"],
        bump,
    )]
    pub global_settings: Box<Account<'info, GlobalSettings>>,

    pub token_program: Interface<'info, Token>,
    pub shares_token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    #[account(
        address = sysvar::instructions::ID
    )]
    pub sysvar_info: AccountInfo<'info>
}

impl<'info> OpenLongWithVaultDepositSetup<'info> {
    pub fn validate(ctx: &Context<Self>, expiration: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        require_gt!(expiration, now, ErrorCode::PositionReqExpired);

        require!(ctx.accounts.permission.can_cosign_swaps(), ErrorCode::InvalidSwapCosigner);

        require!(ctx.accounts.global_settings.can_trade(), ErrorCode::UnpermittedIx);

        position_setup_transaction_introspection_validation(
            &ctx.accounts.sysvar_info,
            OpenLongPositionCleanup::get_hash()
        )?;

        Ok(())
    }

    fn burn_user_shares(&self, shares_to_burn: u64) -> Result<()> {
        let cpi_accounts = Burn {
            mint: self.shares_mint.to_account_info(),
            from: self.owner_shares_account.to_account_info(),
            authority: self.owner.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(self.shares_token_program.to_account_info(), cpi_accounts);

        token_interface::burn(cpi_ctx, shares_to_burn)
    }

    fn transfer_down_payment_from_src_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.src_vault.to_account_info(),
            mint: self.currency.to_account_info(),
            to: self.currency_vault.to_account_info(),
            authority: self.src_lp_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.src_lp_vault)],
        };

        token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
    }

    fn transfer_fee_from_src_vault_to_fee_wallet(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.src_vault.to_account_info(),
            mint: self.currency.to_account_info(),
            to: self.fee_wallet.to_account_info(),
            authority: self.src_lp_vault.to_account_info()
        };

        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.src_lp_vault)]
        };

        token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
    }

    fn open_long_position_setup(
        &mut self,
        #[allow(unused_variables)]
        nonce: u16,
        min_target_amount: u64,
        down_payment: u64,
        principal: u64,
        fee: u64,
        #[allow(unused_variables)]
        expiration: i64,
    ) -> Result<()> {
        // First burn the number of shares required to fulfil `down_payment + fee`
        let amount = down_payment
            .checked_add(fee)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.burn_user_shares(calculate_shares_to_burn(
            &self.src_lp_vault,
            &self.shares_mint,
            amount,
        )?)?;

        self.lp_vault.total_assets = self
            .lp_vault
            .total_assets
            .checked_sub(amount)
            .ok_or(ErrorCode::ArithmeticUnderflow)?;

        self.transfer_borrow_amount_from_vault(
            &self.vault,
            &self.currency,
            &self.currency_vault,
            &self.authority,
            &self.token_program,
            principal
        )?;

        self.transfer_down_payment_from_src_vault(down_payment)?;
        self.transfer_fee_from_src_vault_to_fee_wallet(fee)?;

        let max_principal = self.debt_controller.compute_max_principal(down_payment)?;

        require_gte!(max_principal, principal, ErrorCode::PrincipalTooHigh);

        let total_swap_amount = principal
            .checked_add(down_payment)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        approve_authority_delegation(
            &self.vault,
            &self.authority,
            &self.pool,
            &self.token_program,
            true,
            total_swap_amount
        )?;

        self.open_position_request.set_inner(OpenPositionRequest {
            min_target_amount,
            max_amount_in: down_payment
                .checked_add(principal)
                .ok_or(ErrorCode::ArithmeticOverflow)?,
            pool_key: self.pool.key(),
            position: self.position.key(),
            swap_cache: SwapCache {
                maker_bal_before: self.currency_vault.amount,
                taker_bal_before: self.collateral_vault.amount,
            },
        });

        self.position.set_inner(Position {
            trader: self.owner.key(),
            currency: self.currency.key(),
            collateral: self.collateral_vault.mint,
            down_payment,
            principal,
            collateral_vault: self.collateral_vault.key(),
            lp_vault: self.lp_vault.key(),
            collateral_amount: 0,
            fees_to_be_paid: fee,
            last_funding_timestamp: Clock::get()?.unix_timestamp
        });

        Ok(())
    }
}