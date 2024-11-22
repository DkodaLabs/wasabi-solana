use {
    crate::{
        debt_controller::LEVERAGE_DENOMINATOR,
        error::ErrorCode, events::PositionOpened, short_pool_signer_seeds,
        utils::get_function_hash, BasePool, DebtController, LpVault, OpenPositionRequest, Position,
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

    #[account(
        mut,
        has_one = lp_vault,
    )]
    pub position: Box<Account<'info, Position>>,

    /// The ShortPool that owns the Position
    #[account(
        has_one = collateral_vault,
        has_one = currency_vault,
    )]
    pub pool: Account<'info, BasePool>,

    /// The collateral account that is the destination of the swap
    #[account(mut)]
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,

    // The token account that is the source of the swap (where principal and downpayment are sent)
    #[account(mut)]
    pub currency_vault: InterfaceAccount<'info, TokenAccount>,

    pub currency: InterfaceAccount<'info, Mint>,
    pub collateral: InterfaceAccount<'info, Mint>,

    /// The LP Vault that the user will borrow from
    #[account(
        has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,

    /// The LP Vault's token account.
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        close = owner,
        seeds = [b"open_pos", owner.key().as_ref()],
        bump,
    )]
    pub open_position_request: Box<Account<'info, OpenPositionRequest>>,

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

    fn get_collateral_delta(&self) -> Result<u64> {
        Ok(self.collateral_vault
            .amount
            .checked_sub(self.open_position_request.swap_cache.taker_bal_before)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }

    fn get_principal_delta(&self) -> Result<u64> {
        Ok(self.open_position_request
            .swap_cache
            .maker_bal_before
            .checked_sub(self.currency_vault.amount)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
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
            self.pool.key(),
            self.open_position_request.pool_key,
            ErrorCode::InvalidPool
        );

        // Validate owner receives at least the minimum amount of token being swapped to.
        require_gte!(
            self.get_collateral_delta()?,
            self.open_position_request.min_target_amount,
            ErrorCode::MinTokensNotMet
        );

        Ok(())
    }

    fn revoke_owner_delegation(&self) -> Result<()> {
        let cpi_accounts = Revoke {
            source: self.currency_vault.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[short_pool_signer_seeds!(self.pool)],
        };
        token_interface::revoke(cpi_ctx)
    }

    fn transfer_remaining_principal_from_currency_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.currency_vault.to_account_info(),
            mint: self.currency.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[short_pool_signer_seeds!(self.pool)],
        };
        token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
    }

    pub fn open_short_position_cleanup(&mut self) -> Result<()> {
        self.validate()?;

        // Revoke owner's ability to transfer on behalf of the `currency_vault`
        self.revoke_owner_delegation()?;

        let collateral_received = self.get_collateral_delta()?;
        let principal_used = self.get_principal_delta()?;

        require_gt!(
            self.position
                .down_payment
                .checked_mul(self.debt_controller.max_leverage)
                .ok_or(ErrorCode::ArithmeticOverflow)?
                .checked_div(LEVERAGE_DENOMINATOR)
                .ok_or(ErrorCode::ArithmeticOverflow)?,
            collateral_received,
            ErrorCode::PrincipalTooHigh
        );

        require_gte!(
            self.position.principal,
            principal_used,
            ErrorCode::ValueDeviatedTooMuch
        );

        let remaining_principal = self
            .position
            .principal
            .checked_sub(principal_used)
            .ok_or(ErrorCode::ArithmeticUnderflow)?;

        if remaining_principal > 0 {
            self.transfer_remaining_principal_from_currency_vault(remaining_principal)?;
        }

        self.position.principal = principal_used;
        self.position.collateral_amount = collateral_received
            .checked_add(self.position.down_payment)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        emit!(PositionOpened::new(&self.position, self.pool.is_long_pool));

        Ok(())
    }
}
