use {
    super::OpenLongPositionCleanup,
    crate::{
        error::ErrorCode, long_pool_signer_seeds, lp_vault_signer_seeds,
        utils::position_setup_transaction_introspecation_validation, BasePool, DebtController,
        GlobalSettings, LpVault, OpenPositionRequest, Permission, Position, SwapCache,
    },
    anchor_lang::{prelude::*, solana_program::sysvar},
    anchor_spl::token_interface::{
        self, Approve, Mint, TokenAccount, TokenInterface, TransferChecked,
    },
};

#[derive(Accounts)]
#[instruction(header: OpenLongPositionHeader)]
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
    pub lp_vault: Account<'info, LpVault>,

    /// The LP Vault's token account.
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The LongPool that owns the Position
    #[account(
        has_one = collateral_vault,
        has_one = currency_vault,
    )]
    pub long_pool: Account<'info, BasePool>,

    /// The collateral account that is the destination of the swap
    #[account(mut)]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,

    // The token account that is the source of the swap (where principal and downpayment are sent)
    #[account(mut)]
    pub currency_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral: InterfaceAccount<'info, Mint>,
    pub currency: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = owner,
        seeds = [b"open_pos", owner.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<OpenPositionRequest>(),
    )]
    pub open_position_request: Account<'info, OpenPositionRequest>,

    #[account(
        init,
        payer = owner,
        seeds = [
            b"position", 
            owner.key().as_ref(), 
            long_pool.key().as_ref(), 
            lp_vault.key().as_ref(), 
            &header.nonce.to_le_bytes() // Ensures user can have multiple positions for this
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

    #[account(mut)]
    pub fee_wallet: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [b"debt_controller"],
        bump,
    )]
    pub debt_controller: Account<'info, DebtController>,

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
    pub fn validate(ctx: &Context<Self>, args: &OpenLongPositionArgs) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        require_gt!(args.expiration, now, ErrorCode::PositionReqExpired);

        require!(ctx.accounts.permission.can_cosign_swaps(), ErrorCode::InvalidSwapCosigner);

        // Validate TX only has only one setup IX and has one following cleanup IX
        position_setup_transaction_introspecation_validation(
            &ctx.accounts.sysvar_info,
            OpenLongPositionCleanup::get_hash(),
        )?;

        Ok(())
    }

    fn transfer_borrow_amount_from_vault(&self, amount: u64) -> Result<()> {
        msg!("{}", self.vault.amount);
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
        msg!("down payment");

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
        msg!("fee");
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
            authority: self.long_pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[long_pool_signer_seeds!(self.long_pool)],
        };
        token_interface::approve(cpi_ctx, amount)
    }

    pub fn open_long_position_setup(&mut self, header: &OpenLongPositionHeader, args: &OpenLongPositionArgs) -> Result<()> {
        // This is due to some eccentricity of Anchor's deserialization, when the
        // nonce is not used like this it causes a byte misalignment for the other args
        // leading to erroneous values for principal, fee and expiration. TODO: Figure out
        // why using the nonce this way solves the issue.
        msg!("{}", header.nonce);

        self.transfer_borrow_amount_from_vault(args.principal)?;
        self.transfer_down_payment_from_user(args.down_payment)?;
        self.transfer_from_user_to_fee_wallet(args.fee)?;
        self.currency_vault.reload()?;

        let max_principal = self
            .debt_controller
            .compute_max_principal(args.down_payment);

        require_gte!(max_principal, args.principal, ErrorCode::PrincipalTooHigh);

        let total_swap_amount = args
            .principal
            .checked_add(args.down_payment)
            .expect("overflow");

        // Approve authority to make a swap on behalf of the `currency_vault`
        self.approve_owner_delegation(total_swap_amount)?;

        // Cache data on the `open_position_request` account. We use the value after the borrow in
        // order to track the entire amount being swapped.
        self.open_position_request.set_inner(OpenPositionRequest {
            min_target_amount: args.min_target_amount,
            max_amount_in: args
                .down_payment
                .checked_add(args.principal)
                .expect("overflow"),
            pool_key: self.long_pool.key(),
            position: self.position.key(),
            swap_cache: SwapCache {
                source_bal_before: self.currency_vault.amount,
                destination_bal_before: self.collateral_vault.amount,
            },
        });
        self.position.set_inner(Position {
            trader: self.owner.key(),
            currency: self.currency.key(),
            collateral: self.collateral.key(),
            down_payment: args.down_payment,
            principal: args.principal,
            collateral_vault: self.collateral_vault.key(),
            lp_vault: self.lp_vault.key(),
            collateral_amount: 0,
            fees_to_be_paid: args.fee,
            last_funding_timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(AnchorDeserialize, AnchorSerialize, Debug)]
pub struct OpenLongPositionHeader {
    nonce: u16,
}

#[derive(AnchorDeserialize, AnchorSerialize, Debug)]
#[repr(C)]
pub struct OpenLongPositionArgs {
    /// The minimum amount out required when swapping
    pub min_target_amount: u64,
    /// The initial down payment amount required to open the position (is in `currency` for long, `
    /// collateralCurrency` for short positions)
    pub down_payment: u64,
    /// The total principal amount to be borrowed for the position.
    pub principal: u64,
    /// The timestamp when this position request expires.
    pub expiration: i64,
    /// The fee to be paid for the position
    pub fee: u64,
}

//pub fn handler(ctx: Context<OpenLongPositionSetup>, args: OpenLongPositionArgs) -> Result<()> {
//    // Borrow from LP Vault
//    ctx.accounts
//        .transfer_borrow_amount_from_vault(args.principal)?;
//    ctx.accounts
//        .transfer_down_payment_from_user(args.down_payment)?;
//    // Transfer fees
//    ctx.accounts.transfer_from_user_to_fee_wallet(args.fee)?;
//
//    ctx.accounts.currency_vault.reload()?;
//
//    let max_principal = ctx
//        .accounts
//        .debt_controller
//        .compute_max_principal(args.down_payment);
//
//    if args.principal > max_principal {
//        return Err(ErrorCode::PrincipalTooHigh.into());
//    }
//
//    let total_swap_amount = args
//        .principal
//        .checked_add(args.down_payment)
//        .expect("overflow");
//
//    // Approve user to make swap on behalf of `currency_vault`
//    ctx.accounts.approve_owner_delegation(total_swap_amount)?;
//
//    let collateral_amount = ctx.accounts.collateral_vault.amount;
//
//    // Cache data on the `open_position_request` account. We use the value
//    // after the borrow in order to track the entire amount being swapped.
//    let open_position_request = &mut ctx.accounts.open_position_request;
//    open_position_request.min_target_amount = args.min_target_amount;
//    open_position_request.max_amount_in = args
//        .down_payment
//        .checked_add(args.principal)
//        .expect("overflow");
//    open_position_request.pool_key = ctx.accounts.long_pool.key();
//    open_position_request.position = ctx.accounts.position.key();
//    open_position_request.swap_cache.source_bal_before = ctx.accounts.currency_vault.amount;
//    open_position_request.swap_cache.destination_bal_before = collateral_amount;
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
//
//    Ok(())
//}
