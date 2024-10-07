use anchor_lang::prelude::*;

use crate::{Position, StopLossOrder};

#[derive(Accounts)]
pub struct CloseStopLossOrder<'info> {
  #[account(mut)]
  pub trader: Signer<'info>,
  
  #[account(
    has_one = trader,
  )]
  pub position: Account<'info, Position>,

  #[account(
    mut,
    close = trader,
    seeds = [b"stop_loss_order", position.key().as_ref()],
    bump,
  )]
  pub stop_loss_order: Account<'info, StopLossOrder>,
}

pub fn handler(_ctx: Context<CloseStopLossOrder>) -> Result<()> {
  Ok(())
}