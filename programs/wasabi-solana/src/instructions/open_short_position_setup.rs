use {
    super::OpenShortPositionCleanup,
    crate::{
        error::ErrorCode, lp_vault_signer_seeds, short_pool_signer_seeds,
        utils::setup_transaction_introspection_validation, BasePool, GlobalSettings, LpVault,
        OpenPositionRequest, Permission, Position, SwapCache,
    },
    anchor_lang::{prelude::*, solana_program::sysvar},
    anchor_spl::token_interface::{
        self, Approve, Mint, TokenAccount, TokenInterface, TransferChecked,
    },
};

#[derive(Accounts)]
#[instruction(nonce: u16)]
pub struct OpenShortPositionSetup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = collateral,
        associated_token::authority = owner,
        associated_token::token_program = collateral_token_program,
    )]
    /// The account that holds the owner's target currency
    pub owner_target_currency_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The LP Vault that the user will borrow from
    #[account(
        has_one = vault,
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,
    #[account(mut)]
    /// The LP Vault's token account.
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        has_one = collateral_vault,
        has_one = currency_vault,
    )]
    /// The ShortPool that owns the Position
    pub pool: Box<Account<'info, BasePool>>,
    #[account(mut)]
    /// The collateral account that is the destination of the swap
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
    pub system_program: Program<'info, System>,
    #[account(
        address = sysvar::instructions::ID
    )]
    /// CHECK: Sysvar instruction check applied
    pub sysvar_info: AccountInfo<'info>,
}
impl<'info> OpenShortPositionSetup<'info> {
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
            OpenShortPositionCleanup::get_hash(),
            true,
        )?;

        Ok(())
    }

    pub fn transfer_from_user_to_collateral_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.owner_target_currency_account.to_account_info(),
            mint: self.collateral.to_account_info(),
            to: self.collateral_vault.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            self.collateral_token_program.to_account_info(),
            cpi_accounts,
        );
        token_interface::transfer_checked(cpi_ctx, amount, self.collateral.decimals)
    }

    pub fn transfer_from_user_to_fee_wallet(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.owner_target_currency_account.to_account_info(),
            mint: self.collateral.to_account_info(),
            to: self.fee_wallet.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            self.collateral_token_program.to_account_info(),
            cpi_accounts,
        );
        token_interface::transfer_checked(cpi_ctx, amount, self.collateral.decimals)
    }

    pub fn transfer_from_lp_vault_to_currency_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.currency.to_account_info(),
            to: self.currency_vault.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.currency_token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };
        token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
    }

    pub fn approve_owner_delegation(&self, amount: u64) -> Result<()> {
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

    pub fn open_short_position_setup(
        &mut self,
        #[allow(unused_variables)] nonce: u16,
        min_target_amount: u64,
        down_payment: u64,
        principal: u64,
        fee: u64,
        #[allow(unused_variables)] expiration: i64,
    ) -> Result<()> {
        // Down payment is transferred from the user to the `collateral_vault` since it's not used
        // for swapping when opening a short position.
        self.transfer_from_user_to_collateral_vault(down_payment)?;

        // Transfer fees
        self.transfer_from_user_to_fee_wallet(fee)?;

        // Reload the `collateral_vault` so we can get the balance after the down payment has been
        // made.
        self.collateral_vault.reload()?;

        require_gte!(
            self.vault.amount,
            principal,
            ErrorCode::InsufficientAvailablePrincipal
        );

        // Transfer the borrowed amount to the `currency_vault` to be used in a swap.
        self.transfer_from_lp_vault_to_currency_vault(principal)?;

        // Reload the `currency_vault` so we can get the balance after the principal has be
        // transferred.
        self.currency_vault.reload()?;

        // Approve the user to make a swap on behalf of the `currency_vault`
        self.approve_owner_delegation(principal)?;

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

        // Cache data on the `open_position_request` account. We use the value after the borrow in
        // order to track the entire amount being swapped.
        self.position.set_inner(Position {
            trader: self.owner.key(),
            currency: self.currency.key(),
            collateral: self.collateral.key(),
            down_payment,
            principal,
            collateral_vault: self.collateral_vault.key(),
            collateral_amount: 0, // This doesn't seem right, check why
            // this isn't being set - set after we do the swap
            lp_vault: self.lp_vault.key(),
            fees_to_be_paid: fee,
            last_funding_timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
