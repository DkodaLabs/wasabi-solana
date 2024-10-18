use {
    crate::{
        error::ErrorCode,
        events::PositionOpened,
        short_pool_signer_seeds,
        utils::{get_function_hash, validate_difference},
        BasePool, DebtController, LpVault, OpenPositionRequest, Position,
    },
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{
        self, Mint, Revoke, TokenAccount, TokenInterface, TransferChecked,
    },
};

#[derive(Accounts)]
pub struct OpenShortPositionCleanup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,

    // NOTE: I think these should be the mints rather than the vault addresses
    /// The ShortPool that owns the Position
    #[account(
      has_one = collateral_vault,
      has_one = currency_vault,
    )]
    pub short_pool: Account<'info, BasePool>,

    /// The collateral account that is the destination of the swap
    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = short_pool,
        associated_token::token_program = token_program,
    )]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,

    // The token account that is the source of the swap (where principal and downpayment are sent)
    #[account(
        associated_token::mint = currency_mint,
        associated_token::authority = short_pool,
        associated_token::token_program = token_program,
    )]
    pub currency_vault: InterfaceAccount<'info, TokenAccount>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub currency_mint: InterfaceAccount<'info, Mint>,

    /// The LP Vault that the user will borrow from
    // NOTE: I think this should be the LP Vault mint rather than the vault address
    #[account(
        has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,

    /// The LP Vault's token account.
    #[account(
        mut,
        associated_token::mint = currency_mint,
        associated_token::authority = lp_vault,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
      mut,
      close = owner,
      seeds = [b"open_pos", owner.key().as_ref()],
      bump,
    )]
    pub open_position_request: Box<Account<'info, OpenPositionRequest>>,

    #[account(
        mut,
        has_one = lp_vault,
    )]
    pub position: Box<Account<'info, Position>>,

    #[account(
        seeds = [b"debt_controller"],
        bump,
    )]
    pub debt_controller: Account<'info, DebtController>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> OpenShortPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "open_short_position_cleanup")
    }

    fn get_destination_delta(&self) -> Result<u64> {
        self.collateral_vault
            .amount
            .checked_sub(self.open_position_request.swap_cache.destination_bal_before)
            .ok_or(ErrorCode::Overflow.into())
    }

    fn get_source_delta(&self) -> Result<u64> {
        self.open_position_request
            .swap_cache
            .source_bal_before
            .checked_sub(self.currency_vault.amount)
            .ok_or(ErrorCode::Overflow.into())
    }

    fn validate(&self) -> Result<()> {
        // Validate the same position was used in setup and cleanup
        require_keys_eq!(
            self.position.key(),
            self.open_position_request.position,
            ErrorCode::InvalidPosition
        );
        // Validate the same pool, and thus collateral_vault was used in setup and cleanup.
        require_keys_eq!(
            self.short_pool.key(),
            self.open_position_request.pool_key,
            ErrorCode::InvalidPool
        );

        // Validate owner receives at least the minimum amount of token being swapped to.
        require_gt!(
            self.open_position_request.min_target_amount,
            self.get_destination_delta()?,
            ErrorCode::MinTokensNotMet
        );

        Ok(())
    }

    fn revoke_owner_delegation(&self) -> Result<()> {
        let cpi_accounts = Revoke {
            source: self.currency_vault.to_account_info(),
            authority: self.short_pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[short_pool_signer_seeds!(self.short_pool)],
        };
        token_interface::revoke(cpi_ctx)
    }

    fn transfer_remaining_principal_from_currency_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.currency_vault.to_account_info(),
            mint: self.currency_mint.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.short_pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[short_pool_signer_seeds!(self.short_pool)],
        };
        token_interface::transfer_checked(cpi_ctx, amount, self.currency_mint.decimals)
    }

    pub fn open_short_position_cleanup(&mut self) -> Result<()> {
        self.validate()?;

        // Revoke owner's ability to transfer on behalf of the `currency_vault`
        self.revoke_owner_delegation()?;

        let collateral_received = self.get_destination_delta()?;
        let principal_used = self.get_source_delta()?;

        require_gte!(
            collateral_received,
            self.position
                .down_payment
                .checked_mul(self.debt_controller.max_leverage)
                .ok_or(ErrorCode::Overflow)?,
            ErrorCode::PrincipalTooHigh
        );

        validate_difference(self.position.principal, principal_used, 1)?;

        let remaining_principal = self
            .position
            .principal
            .checked_sub(principal_used)
            .ok_or(ErrorCode::Overflow)?;

        if remaining_principal > 0 {
            self.transfer_remaining_principal_from_currency_vault(remaining_principal)?;
        }

        self.position.principal = principal_used;
        self.position.collateral_amount = collateral_received
            .checked_add(self.position.down_payment)
            .ok_or(ErrorCode::Overflow)?;

        emit!(PositionOpened::new(&self.position));

        Ok(())
    }
}

//pub fn handler(ctx: Context<OpenShortPositionCleanup>) -> Result<()> {
//    ctx.accounts.validate()?;
//    // Revoke owner's ability to transfer on behalf of the `currency_vault`
//    ctx.accounts.revoke_owner_delegation()?;
//
//    let collateral_received = ctx.accounts.get_destination_delta();
//    let principal_used = ctx.accounts.get_source_delta();
//    let principal = ctx.accounts.position.principal;
//    let down_payment = ctx.accounts.position.down_payment;
//
//    if down_payment
//        .checked_mul(ctx.accounts.debt_controller.max_leverage)
//        .expect("overflow")
//        <= collateral_received
//    {
//        return Err(ErrorCode::PrincipalTooHigh.into());
//    }
//    validate_difference(principal, principal_used, 1)?;
//
//    // Return any remaining principal that was transferred to the currency_vault in setup
//    let remaining_principal = ctx
//        .accounts
//        .position
//        .principal
//        .checked_sub(principal_used)
//        .expect("overflow");
//    if remaining_principal > 0 {
//        ctx.accounts
//            .transfer_remaining_principal_from_currency_vault(remaining_principal)?;
//    }
//
//    let position = &mut ctx.accounts.position;
//
//    // Update to the actual principal used
//    position.principal = principal_used;
//    position.collateral_amount = collateral_received
//        .checked_add(position.down_payment)
//        .expect("overflow");
//
//    emit!(PositionOpened::new(position));
//
//    Ok(())
//}
