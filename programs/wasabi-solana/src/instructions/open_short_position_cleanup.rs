use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::{error::ErrorCode, utils::get_function_hash, BasePool, OpenPositionRequest, Position};

#[derive(Accounts)]
pub struct OpenShortPositionCleanup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
    /// The account that holds the owner's base currency
    pub owner_currency_account: Account<'info, TokenAccount>,

    #[account(
      has_one = collateral_vault,
    )]
    /// The ShortPool that owns the Position
    pub short_pool: Account<'info, BasePool>,
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

impl<'info> OpenShortPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "open_short_position_cleanup")
    }

    pub fn validate(&self) -> Result<()> {
        // Validate the same position was used in setup and cleanup
        if self.position.key() != self.open_position_request.position {
            return Err(ErrorCode::InvalidPosition.into());
        }
        // Validate the same pool, and thus collateral_vault was used in setup and cleanup.
        if self.short_pool.key() != self.open_position_request.pool_key {
            return Err(ErrorCode::InvalidPool.into());
        }

        
        Ok(())
    }
}

pub fn handler(ctx: Context<OpenShortPositionCleanup>) -> Result<()> {
    ctx.accounts.validate()?;

    // store the amount of
    Ok(())
}
