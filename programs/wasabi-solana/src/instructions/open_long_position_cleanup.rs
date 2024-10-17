use {
    crate::{
        error::ErrorCode, events::PositionOpened, long_pool_signer_seeds, utils::get_function_hash,
        BasePool, OpenPositionRequest, Position,
    },
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{self, Revoke, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
pub struct OpenLongPositionCleanup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,

    #[account(
        has_one = collateral_vault,
        has_one = currency_vault,
    )]
    /// The LongPool that owns the Position
    pub long_pool: Account<'info, BasePool>,
    /// The collateral account that is the destination of the swap
    pub collateral_vault: InterfaceAccount<'info, TokenAccount>,
    // The token account that is the source of the swap (where principal and downpayment are sent)
    pub currency_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
    mut,
    close = owner,
    seeds = [b"open_pos", owner.key().as_ref()],
    bump,
  )]
    pub open_position_request: Box<Account<'info, OpenPositionRequest>>,

    #[account(mut)]
    pub position: Box<Account<'info, Position>>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> OpenLongPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "open_long_position_cleanup")
    }

    fn get_destination_delta(&self) -> Result<u64> {
        self.collateral_vault
            .amount
            .checked_sub(self.open_position_request.swap_cache.destination_bal_before)
            .ok_or(ErrorCode::Overflow.into())
    }

    fn validate(&self) -> Result<()> {
        // Validate the same position was used in setup and cleanup
        require_eq!(
            self.position.key(),
            self.open_position_request.position,
            ErrorCode::InvalidPosition
        );

        // Validate the same pool, and thus collateral_vault was used in setup and cleanup.
        require_eq!(
            self.long_pool.key(),
            self.open_position_request.pool_key,
            ErrorCode::InvalidPool
        );

        // Validate owner receives at least the minimum amount of token being swapped to.
        require_gt!(
            self.open_position_request.min_target_amount,
            self.get_destination_delta()?,
            ErrorCode::MinTokensNotMet
        );

        // Validate owner does not spend more tokens than requested.
        require_gt!(
            self.open_position_request
                .swap_cache
                .source_bal_before
                .checked_sub(self.currency_vault.amount)
                .ok_or(ErrorCode::Overflow)?,
            self.open_position_request.max_amount_in,
            ErrorCode::SwapAmountExceeded
        );

        Ok(())
    }

    fn revoke_owner_delegation(&self) -> Result<()> {
        let cpi_accounts = Revoke {
            source: self.currency_vault.to_account_info(),
            authority: self.long_pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[long_pool_signer_seeds!(self.long_pool)],
        };
        token_interface::revoke(cpi_ctx)
    }

    pub fn open_long_position_cleanup(&mut self) -> Result<()> {
        self.validate()?;
        self.revoke_owner_delegation()?;
        self.position.collateral_amount = self.get_destination_delta()?;

        emit!(PositionOpened::new(&self.position));

        Ok(())
    }
}

//pub fn handler(ctx: Context<OpenLongPositionCleanup>) -> Result<()> {
//    ctx.accounts.validate()?;
//    // Revoke owner's ability to transfer on behalf of the `currency_vault`
//    ctx.accounts.revoke_owner_delegation()?;
//
//    let destination_delta = ctx.accounts.get_destination_delta();
//
//    let position = &mut ctx.accounts.position;
//    position.collateral_amount = destination_delta;
//
//    emit!(PositionOpened::new(position));
//
//    Ok(())
//}
