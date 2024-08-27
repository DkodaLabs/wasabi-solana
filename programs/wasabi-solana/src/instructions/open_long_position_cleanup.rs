use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::{error::ErrorCode, BasePool, OpenPositionRequest};

use super::get_function_hash;

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
}

impl<'info> OpenLongPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "open_long_position_cleanup")
    }

    pub fn validate(&self) -> Result<()> {
        let destination_balance_diff = self
            .collateral_vault
            .amount
            .checked_sub(self.open_position_request.swap_cache.destination_bal_before)
            .expect("overflow");

        if destination_balance_diff < self.open_position_request.min_amount_out {
            return Err(ErrorCode::MinTokensNotMet.into());
        }
        Ok(())
    }
}

pub fn handler(ctx: Context<OpenLongPositionCleanup>) -> Result<()> {
    ctx.accounts.validate()?;
    // TODO: Validate the swap exchanged the correct amount of tokens
    // TODO: Transfer the tokens to the long_pool
    Ok(())
}
