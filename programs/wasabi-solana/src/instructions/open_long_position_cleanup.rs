use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::{error::ErrorCode, utils::get_function_hash, BasePool, OpenPositionRequest, Position};

#[derive(Accounts)]
pub struct OpenLongPositionCleanup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
    /// The account that holds the owner's base currency
    pub owner_currency_account: Account<'info, TokenAccount>,

    #[account(
      has_one = collateral_vault,
  )]
    /// The LongPool that owns the Position
    pub long_pool: Account<'info, BasePool>,
    /// The collateral account that is the destination of the swap
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(
    mut,
    close = owner,
    seeds = [b"open_pos", owner.key().as_ref()],
    bump,
  )]
    pub open_position_request: Account<'info, OpenPositionRequest>,

    #[account(mut)]
    pub position: Account<'info, Position>,
}

impl<'info> OpenLongPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "open_long_position_cleanup")
    }

    pub fn get_destination_delta(&self) -> u64 {
        self.collateral_vault
            .amount
            .checked_sub(self.open_position_request.swap_cache.destination_bal_before)
            .expect("overflow")
    }

    pub fn validate(&self) -> Result<()> {
        // Validate the same position was used in setup and cleanup
        if self.position.key() != self.open_position_request.position {
            return Err(ErrorCode::InvalidPosition.into());
        }

        // Validate the same pool, and thus collateral_vault was used in setup and cleanup.
        if self.long_pool.key() != self.open_position_request.pool_key {
            return Err(ErrorCode::InvalidPool.into());
        }

        // Validate owner receives at least the minimum amount of token being swapped to.
        let destination_balance_delta = self.get_destination_delta();

        if destination_balance_delta < self.open_position_request.min_amount_out {
            return Err(ErrorCode::MinTokensNotMet.into());
        }

        // Validate owner does not spend more tokens than requested.
        let source_balance_delta = self
            .open_position_request
            .swap_cache
            .source_bal_before
            .checked_sub(self.owner_currency_account.amount)
            .expect("overflow");

        if source_balance_delta > self.open_position_request.max_amount_in {
            return Err(ErrorCode::SwapAmountExceeded.into());
        }

        Ok(())
    }
}

pub fn handler(ctx: Context<OpenLongPositionCleanup>) -> Result<()> {
    ctx.accounts.validate()?;

    let destination_delta = ctx.accounts.get_destination_delta();

    let position = &mut ctx.accounts.position;
    position.collateral_amount = destination_delta;
    Ok(())
}
