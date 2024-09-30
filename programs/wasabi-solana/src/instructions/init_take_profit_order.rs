use anchor_lang::prelude::*;

use crate::{Position, TakeProfitOrder};

// Only Position's trader can invoke InitTakeProfitOrder.
// Limitation of 1 TP Order per Position. To modify, user must close the
// TP order and init a new one.

#[derive(Accounts)]
pub struct InitTakeProfitOrder<'info> {
  #[account(mut)]
  pub trader: Signer<'info>,
  
  #[account(
    has_one = trader,
  )]
  pub position: Account<'info, Position>,

  #[account(
    init,
    payer = trader,
    seeds = [b"take_profit_order", position.key().as_ref()],
    bump,
    space = 8 + std::mem::size_of::<TakeProfitOrder>(),
  )]
  pub take_profit_order: Account<'info, TakeProfitOrder>,

  pub system_program: Program<'info, System>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct InitTakeProfitOrderArgs {
  min_amount_out: u64,
}

pub fn handler(ctx: Context<InitTakeProfitOrder>, args: InitTakeProfitOrderArgs) -> Result<()> {
  let take_profit_order = &mut ctx.accounts.take_profit_order;
  take_profit_order.min_amount_out = args.min_amount_out;
  take_profit_order.position = ctx.accounts.position.key();
  
  Ok(())
}