use anchor_lang::prelude::*;

use crate::{Position, TakeProfitOrder};

#[derive(Accounts)]
pub struct CloseTakeProfitOrder<'info> {
  #[account(mut)]
  pub trader: Signer<'info>,
  
  #[account(
    has_one = trader,
  )]
  pub position: Account<'info, Position>,

  #[account(
    mut,
    close = trader,
    seeds = [b"take_profit_order", position.key().as_ref()],
    bump,
  )]
  pub take_profit_order: Account<'info, TakeProfitOrder>,
}

pub fn handler(_ctx: Context<CloseTakeProfitOrder>) -> Result<()> {
  Ok(())
}