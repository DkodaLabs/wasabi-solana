use anchor_lang::prelude::*;

#[account]
pub struct TakeProfitOrder {
  /// Position this Take Profit Order corresponds to
  pub position: Pubkey,
  /// The min payout required for the order to trigger
  pub min_amount_out: u64,
}