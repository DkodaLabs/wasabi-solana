use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::OpenPositionRequest;

use super::get_function_hash;

#[derive(Accounts)]
pub struct OpenLongPositionCleanup<'info> {
  #[account(mut)]
  /// The wallet that owns the assets
  pub owner: Signer<'info>,
  /// The account that holds the owner's base currency
  pub owner_currency_account: Account<'info, TokenAccount>,

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
}

pub fn handler(_ctx: Context<OpenLongPositionCleanup>) -> Result<()> {
  // TODO: Validate the swap exchanged the correct amount of tokens
  // TODO: Transfer the tokens to the long_pool
  Ok(())
}
