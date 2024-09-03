use anchor_lang::prelude::*;

use crate::{utils::get_function_hash, ClosePositionRequest};

#[derive(Accounts)]
pub struct CloseLongPositionCleanup<'info> {
    owner: Signer<'info>,
    #[account(
    mut,
    close = owner,
    seeds = [b"close_pos", owner.key().as_ref()],
    bump,
  )]
    pub close_position_request: Account<'info, ClosePositionRequest>,
}

impl<'info> CloseLongPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "close_long_position_cleanup")
    }
}

pub fn handler(_ctx: Context<CloseLongPositionCleanup>) -> Result<()> {
    // TODO: revoke "owner" ability to swap on behalf of the collateral vault
    Ok(())
}
