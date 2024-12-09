use {
    super::OpenShortPositionCleanup,
    crate::{
        error::ErrorCode,
        lp_vault_signer_seeds,
        utils::{
            approve_authority_delegation, calculate_shares_to_burn,
            position_setup_transaction_introspection_validation,
        },
        BasePool, GlobalSettings, LpVault, OpenPositionRequest, OpenShortPositionSetup, Permission,
        Position, SwapCache,
    },
    anchor_lang::{prelude::*, solana_program::sysvar},
    anchor_spl::{
        token_2022::{self, Token2022},
        token_interface::{self, Burn, Mint, TokenAccount, TokenInterface, TransferChecked},
    },
};

#[derive(Accounts)]
#[instruction(nonce: u16)]
pub struct OpenShortWithVaultDeposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The shares account for collateral - is synonymous with `owner_target_currency_account`
    #[account(
        mut,
        associated_token::mint = shares_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_2022::ID
    )]
    pub owner_shares_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub src_lp_vault: Box<Account<'info, LpVault>>,

    #[account(
        mut,
        address = src_lp_vault.vault @ ErrorCode::IncorrectVault
    )]
    pub src_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(has_one = vault)]
    pub lp_vault: Box<Account<'info, LpVault>>,

    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        has_one = collateral_vault,
        has_one = currency_vault,
    )]
    pub pool: Box<Account<'info, BasePool>>,

    #[account(mut)]
    pub currency_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency: Box<InterfaceAccount<'info, Mint>>,

    pub collateral: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub shares_mint: Box<InterfaceAccount<'info, Mint>>,

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
            &nonce.to_le_bytes()
        ],
        bump,
        space = 8 + std::mem::size_of::<Position>(),
    )]
    pub position: Box<Account<'info, Position>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
    )]
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

    #[account(address = sysvar::instructions::ID)]
    /// CHECK: Sysvar instruction check applied
    pub sysvar_info: AccountInfo<'info>,
}

impl<'info> OpenShortWithVaultDeposit<'info> {
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

        // Validate TX only has only one setup IX and has one following cleanup IX
        position_setup_transaction_introspection_validation(
            &ctx.accounts.sysvar_info,
            OpenShortPositionCleanup::get_hash(),
        )?;

        Ok(())
    }

    fn transfer_from_src_vault_to_collateral_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.src_vault.to_account_info(),
            mint: self.collateral.to_account_info(),
            to: self.collateral_vault.to_account_info(),
            authority: self.owner.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.collateral_token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.src_lp_vault)],
        };

        token_interface::transfer_checked(cpi_ctx, amount, self.collateral.decimals)
    }

    fn transfer_from_src_vault_to_fee_wallet(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.src_vault.to_account_info(),
            mint: self.collateral.to_account_info(),
            to: self.fee_wallet.to_account_info(),
            authority: self.owner.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.collateral_token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.src_lp_vault)],
        };

        token_interface::transfer_checked(cpi_ctx, amount, self.collateral.decimals)
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

    pub fn open_short_position_with_vault_deposit_setup<'a: 'info>(
        &'a mut self,
        #[allow(unused_variables)] nonce: u16,
        min_target_amount: u64,
        down_payment: u64,
        principal: u64,
        fee: u64,
        #[allow(unused_variables)] expiration: i64,
    ) -> Result<()> {
        let amount = down_payment
            .checked_add(fee)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        let shares_to_burn =
            calculate_shares_to_burn(*self.src_lp_vault.clone(), &self.shares_mint, amount)?;

        self.burn_user_shares(shares_to_burn)?;

        self.src_lp_vault.total_assets = self
            .src_lp_vault
            .total_assets
            .checked_sub(amount)
            .ok_or(ErrorCode::ArithmeticUnderflow)?;

        self.transfer_from_src_vault_to_fee_wallet(down_payment)?;

        self.transfer_from_src_vault_to_fee_wallet(fee)?;

        self.collateral_vault.reload()?;

        require_gte!(
            self.vault.amount,
            principal,
            ErrorCode::InsufficientAvailablePrincipal
        );

        OpenShortPositionSetup::transfer_from_lp_vault_to_currency_vault(
            &self.vault,
            &self.currency,
            *self.currency_vault.clone(),
            &self.lp_vault,
            &self.currency_token_program,
            principal,
        )?;

        self.currency_vault.reload()?;

        approve_authority_delegation(
            &self.currency_vault,
            &self.authority,
            &self.pool,
            &self.currency_token_program,
            false,
            principal,
        )?;

        self.open_position_request.set_inner(OpenPositionRequest {
            position: self.position.key(),
            pool_key: self.pool.key(),
            min_target_amount,
            max_amount_in: 0, // CHECK: Why isn't this being set - Close Position Request - set to
            // collateral_amount - set to the `args.principal`
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
            lp_vault: self.lp_vault.key(),
            fees_to_be_paid: fee,
            last_funding_timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
