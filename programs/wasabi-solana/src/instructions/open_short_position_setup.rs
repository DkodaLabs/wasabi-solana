use {
    super::OpenShortPositionCleanup,
    crate::{
        SwapCache,
        error::ErrorCode, lp_vault_signer_seeds, short_pool_signer_seeds,
        utils::position_setup_transaction_introspecation_validation, BasePool, GlobalSettings,
        LpVault, OpenPositionRequest, Permission, Position,
    },
    anchor_lang::{prelude::*, solana_program::sysvar},
    anchor_spl::token_interface::{self, Approve, TokenInterface, TokenAccount, TransferChecked, Mint},
};

#[derive(Accounts)]
#[instruction(args: OpenShortPositionArgs)]
pub struct OpenShortPositionSetup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = currency_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    /// The account that holds the owner's base currency
    pub owner_currency_account: Box<InterfaceAccount<'info, TokenAccount>>,

    // TODO: Check
    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    /// The account that holds the owner's target currency
    pub owner_target_currency_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The LP Vault that the user will borrow from
    #[account(
        has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,
    #[account(mut)]
    /// The LP Vault's token account.
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        has_one = collateral_vault,
        has_one = currency_vault,
    )]
    /// The ShortPool that owns the Position
    pub short_pool: Account<'info, BasePool>,
    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = short_pool,
        associated_token::token_program = token_program,
    )]
    /// The collateral account that is the destination of the swap
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    // The token account that is the source of the swap (where principal and downpayment are sent)
    #[account(
        mut,
        associated_token::mint = currency_mint,
        associated_token::authority = short_pool,
        associated_token::token_program = token_program,
    )]
    pub currency_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub currency_mint: InterfaceAccount<'info, Mint>,

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
            short_pool.key().as_ref(), 
            lp_vault.key().as_ref(), 
            &args.nonce.to_le_bytes()
        ],
        bump,
        space = 8 + std::mem::size_of::<Position>(),
    )]
    pub position: Box<Account<'info, Position>>,

    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
    )]
    pub permission: Box<Account<'info, Permission>>,

    #[account(mut)]
    pub fee_wallet: Box<InterfaceAccount<'info, TokenAccount>>,

    pub global_settings: Box<Account<'info, GlobalSettings>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    #[account(
      address = sysvar::instructions::ID
    )]
    /// CHECK: Sysvar instruction check applied
    pub sysvar_info: AccountInfo<'info>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct OpenShortPositionArgs {
    /// The nonce of the Position
    pub nonce: u16,
    /// The minimum amount out required when swapping
    pub min_target_amount: u64,
    /// The initial down payment amount required to open the position (is in `currency` for long, `collateralCurrency` for short positions)
    pub down_payment: u64,
    /// The total principal amount to be borrowed for the position.
    pub principal: u64,
    /// The address of the currency to be borrowed and sold for the position.
    pub currency: Pubkey,
    /// The timestamp when this position request expires.
    pub expiration: i64,
    /// The fee to be paid for the position
    pub fee: u64,
}

impl<'info> OpenShortPositionSetup<'info> {
    pub fn validate(ctx: &Context<Self>, _args: &OpenShortPositionArgs) -> Result<()> {
        require!(!ctx.accounts.permission.can_cosign_swaps(), ErrorCode::InvalidSwapCosigner);

        // Validate TX only has only one setup IX and has one following cleanup IX
        position_setup_transaction_introspecation_validation(
            &ctx.accounts.sysvar_info,
            OpenShortPositionCleanup::get_hash(),
        )?;

        Ok(())
    }

    pub fn transfer_from_user_to_collateral_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.owner_target_currency_account.to_account_info(),
            mint: self.collateral_mint.to_account_info(),
            to: self.collateral_vault.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, self.collateral_mint.decimals)
    }

    pub fn transfer_from_user_to_fee_wallet(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.owner_target_currency_account.to_account_info(),
            mint: self.collateral_mint.to_account_info(),
            to: self.fee_wallet.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, self.collateral_mint.decimals)
    }

    pub fn transfer_from_lp_vault_to_currency_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.currency_mint.to_account_info(),
            to: self.currency_vault.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };
        token_interface::transfer_checked(cpi_ctx, amount, self.currency_mint.decimals)
    }

    pub fn approve_owner_delegation(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Approve {
            to: self.currency_vault.to_account_info(),
            delegate: self.authority.to_account_info(),
            authority: self.short_pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[short_pool_signer_seeds!(self.short_pool)],
        };
        token_interface::approve(cpi_ctx, amount)
    }

    pub fn open_short_position_setup(&mut self, args: &OpenShortPositionArgs) -> Result<()> {
        // Down payment is transferred from the user to the `collateral_vault` since it's not used
        // for swapping when opening a short position.
        self.transfer_from_user_to_collateral_vault(args.down_payment)?;

        // Transfer fees
        self.transfer_from_user_to_fee_wallet(args.fee)?;

        // Reload the `collateral_vault` so we can get the balance after the down payment has been
        // made.
        self.collateral_vault.reload()?;

        require_gt!(args.principal, self.vault.amount, ErrorCode::InsufficientAvailablePrincipal);

        // Transfer the borrowed amount to the `currency_vault` to be used in a swap.
        self.transfer_from_lp_vault_to_currency_vault(args.principal)?;

        // Reload the `currency_vault` so we can get the balance after the principal has be
        // transferred.
        self.currency_vault.reload()?;

        // Approve the user to make a swap on behalf of the `currency_vault`
        self.approve_owner_delegation(args.principal)?;

        self.open_position_request.set_inner(OpenPositionRequest {
            position: self.position.key(),
            pool_key: self.short_pool.key(),
            min_target_amount: args.min_target_amount,
            max_amount_in: 0, // CHECK: Why isn't this being set - Close Position Request - set to
            // collateral_amount - set to the `args.principal`
            swap_cache: SwapCache {
                destination_bal_before: self.collateral_vault.amount,
                source_bal_before: self.currency_vault.amount,
            }
        });

        // Cache data on the `open_position_request` account. We use the value after the borrow in
        // order to track the entire amount being swapped.
        self.position.set_inner(Position {
            trader: self.owner.key(),
            currency: self.currency_mint.key(),
            collateral: self.collateral_mint.key(),
            down_payment: args.down_payment,
            principal: args.principal,
            collateral_vault: self.collateral_vault.key(),
            collateral_amount: 0, // This doesn't seem right, check why
            // this isn't being set - set after we do the swap
            lp_vault: self.lp_vault.key(),
            fees_to_be_paid: args.fee,
            last_funding_timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

//pub fn handler(ctx: Context<OpenShortPositionSetup>, args: OpenShortPositionArgs) -> Result<()> {
//    // Down payment is transfered from user to collateral_vault since it's
//    // not used for swapping when opening a short position.
//    ctx.accounts
//        .transfer_from_user_to_collateral_vault(args.down_payment)?;
//    // Transfer fees
//    ctx.accounts.transfer_from_user_to_fee_wallet(args.fee)?;
//
//    // Reload the collateral_vault account so we can get the balance after
//    // downpayment has been made.
//    ctx.accounts.collateral_vault.reload()?;
//
//    if args.principal > ctx.accounts.vault.amount {
//        return Err(ErrorCode::InsufficientAvailablePrincipal.into());
//    }
//
//    // Transfer the borrowed amount to `currency_vault` to be used in swap.
//    ctx.accounts
//        .transfer_from_lp_vault_to_currency_vault(args.principal)?;
//    // Reload the currency_vault account so we can get the balance after
//    // princpal transfer has been made.
//    ctx.accounts.currency_vault.reload()?;
//
//    // Approve user to make swap on behalf of `currency_vault`
//    ctx.accounts.approve_owner_delegation(args.principal)?;
//
//    // Cache data on the `open_position_request` account. We use the value
//    // after the borrow in order to track the entire amount being swapped.
//    let open_position_request = &mut ctx.accounts.open_position_request;
//
//    open_position_request.position = ctx.accounts.position.key();
//    open_position_request.pool_key = ctx.accounts.short_pool.key();
//    open_position_request.min_target_amount = args.min_target_amount;
//    open_position_request.swap_cache.destination_bal_before = ctx.accounts.collateral_vault.amount;
//    open_position_request.swap_cache.source_bal_before = ctx.accounts.currency_vault.amount;
//
//    let position = &mut ctx.accounts.position;
//    position.trader = ctx.accounts.owner.key();
//    position.currency = ctx.accounts.vault.mint;
//    position.collateral_currency = ctx.accounts.collateral_vault.mint;
//    position.down_payment = args.down_payment;
//    position.principal = args.principal;
//    position.collateral_vault = ctx.accounts.collateral_vault.key();
//    position.lp_vault = ctx.accounts.lp_vault.key();
//    position.fees_to_be_paid = args.fee;
//    position.last_funding_timestamp = Clock::get()?.unix_timestamp;
//    Ok(())
//}
