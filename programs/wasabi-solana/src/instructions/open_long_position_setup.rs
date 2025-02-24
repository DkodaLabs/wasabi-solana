use {
    super::OpenLongPositionCleanup,
    crate::{
        error::ErrorCode, long_pool_signer_seeds, lp_vault_signer_seeds,
        utils::setup_transaction_introspection_validation, BasePool, DebtController,
        GlobalSettings, LpVault, OpenPositionRequest, Permission, Position, SwapCache,
    },
    anchor_lang::{prelude::*, solana_program::sysvar},
    anchor_spl::token_interface::{
        self, Approve, Mint, TokenAccount, TokenInterface, TransferChecked,
    },
};

#[derive(Accounts)]
#[instruction(nonce: u16)]
pub struct OpenLongPositionSetup<'info> {
    /// The wallet that owns the assets
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The account that holds the owner's quote currency
    #[account(
        mut,
        associated_token::mint = currency,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub owner_currency_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The LP Vault that the user will borrow from
    /// For long positions, this is the `currency` i.e. the `quote`
    #[account(
        has_one = vault
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,

    /// The LP Vault's token account.
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The LongPool that owns the Position
    #[account(
        has_one = collateral_vault,
        has_one = currency_vault,
    )]
    pub pool: Box<Account<'info, BasePool>>,

    /// The collateral account that is the destination of the swap
    #[account(mut)]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    // The token account that is the source of the swap (where principal and downpayment are sent)
    #[account(mut)]
    pub currency_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency: Box<InterfaceAccount<'info, Mint>>,
    pub collateral: Box<InterfaceAccount<'info, Mint>>,

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
            &nonce.to_le_bytes() // Ensures user can have multiple positions for this
            // particular pool
        ],
        bump,
        space = 8 + std::mem::size_of::<Position>(),
    )]
    pub position: Box<Account<'info, Position>>,

    // Backend authority
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
        seeds = [b"debt_controller"],
        bump,
    )]
    pub debt_controller: Box<Account<'info, DebtController>>,

    #[account(
        seeds = [b"global_settings"],
        bump,
    )]
    pub global_settings: Box<Account<'info, GlobalSettings>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    #[account(
        address = sysvar::instructions::ID
    )]
    /// CHECK: Sysvar instruction check applied
    pub sysvar_info: AccountInfo<'info>,
}

impl<'info> OpenLongPositionSetup<'info> {
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
        setup_transaction_introspection_validation(
            &ctx.accounts.sysvar_info,
            OpenLongPositionCleanup::get_hash(),
            true,
        )?;

        Ok(())
    }

    fn transfer_borrow_amount_from_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.currency.to_account_info(),
            to: self.currency_vault.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };
        token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
    }

    fn transfer_down_payment_from_user(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.owner_currency_account.to_account_info(),
            mint: self.currency.to_account_info(),
            to: self.currency_vault.to_account_info(),
            authority: self.owner.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
    }

    fn transfer_from_user_to_fee_wallet(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.owner_currency_account.to_account_info(),
            mint: self.currency.to_account_info(),
            to: self.fee_wallet.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
    }

    fn approve_owner_delegation(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Approve {
            to: self.currency_vault.to_account_info(),
            delegate: self.authority.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[long_pool_signer_seeds!(self.pool)],
        };
        token_interface::approve(cpi_ctx, amount)
    }

    pub fn open_long_position_setup(
        &mut self,
        #[allow(unused_variables)] nonce: u16,
        min_target_amount: u64,
        down_payment: u64,
        principal: u64,
        fee: u64,
        #[allow(unused_variables)] expiration: i64,
    ) -> Result<()> {
        self.transfer_borrow_amount_from_vault(principal)?;
        self.transfer_down_payment_from_user(down_payment)?;
        self.transfer_from_user_to_fee_wallet(fee)?;
        self.currency_vault.reload()?;

        let max_principal = self.debt_controller.compute_max_principal(down_payment)?;

        require_gte!(max_principal, principal, ErrorCode::PrincipalTooHigh);

        let total_swap_amount = principal
            .checked_add(down_payment)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        // Approve authority to make a swap on behalf of the `currency_vault`
        self.approve_owner_delegation(total_swap_amount)?;

        // Cache data on the `open_position_request` account. We use the value after the borrow in
        // order to track the entire amount being swapped.
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
            collateral: self.collateral.key(),
            down_payment,
            principal,
            collateral_vault: self.collateral_vault.key(),
            lp_vault: self.lp_vault.key(),
            collateral_amount: 0,
            fees_to_be_paid: fee,
            last_funding_timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
