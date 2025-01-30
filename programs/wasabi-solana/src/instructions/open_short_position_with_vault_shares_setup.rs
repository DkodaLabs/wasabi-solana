use {
    super::OpenShortPositionCleanup,
    crate::{
        error::ErrorCode, lp_vault_signer_seeds, short_pool_signer_seeds,
        utils::position_setup_transaction_introspection_validation, BasePool, GlobalSettings,
        LpVault, OpenPositionRequest, Permission, Position, SwapCache,
    },
    anchor_lang::{prelude::*, solana_program::sysvar},
    anchor_spl::{
        token_2022::Token2022,
        token_interface::{
            self, Approve, Burn, Mint, TokenAccount, TokenInterface, TransferChecked,
        },
    },
};

#[derive(Accounts)]
#[instruction(nonce: u16)]
pub struct OpenShortPositionWithVaultSharesSetup<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = shares,
        associated_token::authority = owner,
        associated_token::token_program = shares_token_program,
    )]
    pub owner_shares_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral_lp_vault: Box<Account<'info, LpVault>>,
    #[account(
        mut,
        address = collateral_lp_vault.vault @ ErrorCode::InvalidVault
    )]
    pub collateral_lp_vault_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency_lp_vault: Box<Account<'info, LpVault>>,
    #[account(
        mut,
        address = currency_lp_vault.vault @ ErrorCode::InvalidVault
    )]
    pub currency_lp_vault_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        has_one = collateral_vault,
        has_one = currency_vault,
    )]
    pub pool: Box<Account<'info, BasePool>>,

    #[account(mut)]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub currency_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency: Box<InterfaceAccount<'info, Mint>>,
    pub collateral: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [collateral_lp_vault.key().as_ref(), currency.key().as_ref()],
        bump,
        mint::authority = lp_vault,
    )]
    pub shares: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = owner,
        seeds = [b"open_pos", owner.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<OpenPositionRequest>(),
    )]
    pub open_position_request: Box<Account<'info, OpenPositionRequest>>,

    #[account(
        init,
        payer = owner,
        seeds = [
            b"position",
            owner.key().as_ref(),
            pool.key().as_ref(),
            lp_vault.key().as_ref(),
            &nonce.to_le_bytes() // Ensures user can have multiple positions for this particular
            // pool
        ],
        bump,
        space = 8 + std::mem::size_of::<Position>(),
    )]
    pub position: Box<Account<'info, Position>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Box<Account<'info, Permission>>,

    #[account(
        mut,
        constraint = fee_wallet.owner == global_settings.fee_wallet
    )]
    pub fee_wallet: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [b"global_settings"],
        bump,
    )]
    pub global_settings: Box<Account<'info, GlobalSettings>>,

    pub currency_token_program: Interface<'info, TokenInterface>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
    pub shares_token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,

    /// CHECK sysvar instruction check applied
    #[account(address = sysvar::instructions::ID)]
    pub sysvar_info: AccountInfo<'info>,
}

impl<'info> OpenShortPositionWithVaultSharesSetup<'info> {
    pub fn validate(ctx: &Context<Self>, expiration: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        require_gt!(expiration, now, ErrorCode::PositionReqExpired);
        require!(
            ctx.accounts.permission.can_cosign_swaps(),
            ErrorCode::InvalidSwapCosigner
        );
        require!(
            ctx.accounts.global_settings.can_trade(),
            ErrorCode::UnpermittedIx
        );

        position_setup_transaction_introspection_validation(
            &ctx.accounts.sysvar_info,
            OpenShortPositionCleanup::get_hash(),
        )?;

        Ok(())
    }

    fn transfer_from_vault_to_collateral_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.collateral_lp_vault_ata.to_account_info(),
            mint: self.collateral.to_account_info(),
            to: self.collateral_vault.to_account_info(),
            authority: self.collateral_lp_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.collateral_token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.collateral_lp_vault)],
        };

        token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
    }

    fn transfer_borrow_amount_from_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.currency_lp_vault_ata.to_account_info(),
            mint: self.currency.to_account_info(),
            to: self.currency_vault.to_account_info(),
            authority: self.currency_lp_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.currency_token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.currency_lp_vault)],
        };

        token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
    }

    fn transfer_fee_from_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.collateral_lp_vault_ata.to_account_info(),
            mint: self.collateral.to_account_info(),
            to: self.fee_wallet.to_account_info(),
            authority: self.collateral_lp_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.collateral_token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.collateral_lp_vault)],
        };

        token_interface::transfer_checked(cpi_ctx, amount, self.collateral.decimals)
    }

    fn approve_authority_delegation(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Approve {
            to: self.currency_vault.to_account_info(),
            delegate: self.authority.to_account_info(),
            authority: self.pool.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.currency_token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[short_pool_signer_seeds!(self.pool)],
        };

        token_interface::approve(cpi_ctx, amount)
    }

    pub fn open_short_position_with_shares_setup(
        &mut self,
        #[allow(unused_variables)] nonce: u16,
        min_target_amount: u64,
        down_payment: u64,
        principal: u64,
        fee: u64,
        #[allow(unused_variables)] expiration: i64,
    ) -> Result<()> {
        let total_withdraw_amount = down_payment
            .checked_add(fee)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.burn_shares_from_user(
            self.collateral_lp_vault
                .calculate_burn_amount(self.shares.supply, total_withdraw_amount),
        )?;

        self.transfer_from_vault_to_collateral_vault(down_payment)?;
        self.transfer_fee_from_vault(fee)?;

        self.collateral_lp_vault.total_assets = self
            .collateral_lp_vault
            .total_assets
            .checked_sub(total_withdraw_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.collateral_vault.reload()?;

        require_gte!(
            self.collateral_lp_vault_ata.amount,
            principal,
            ErrorCode::InsufficientAvailablePrincipal
        );

        self.transfer_borrow_amount_from_vault(principal)?;

        self.currency_vault.reload()?;

        self.approve_authority_delegation(principal)?;

        self.open_position_request.set_inner(OpenPositionRequest {
            min_target_amount,
            max_amount_in: 0,
            pool_key: self.pool.key(),
            position: self.position.key(),
            swap_cache: SwapCache {
                taker_bal_before: self.collateral_vault.amount,
                maker_bal_before: self.currency_vault.amount,
            },
        });

        self.position.set_inner(Position {
            trader: self.owner.key(),
            currency: self.currency.key(),
            collateral: self.collateral.key(),
            down_payment,
            principal,
            collateral_vault: self.collateral_vault.key(),
            collateral_amount: 0,
            lp_vault: self.collateral_lp_vault.key(),
            fees_to_be_paid: fee,
            last_funding_timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}