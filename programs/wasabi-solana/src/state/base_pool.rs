use anchor_lang::prelude::*;


#[account]
pub struct BasePool {
  /// The mint address for the collateral type this pool supports
  pub collateral: Pubkey,
  /// Flag to determine if it's a long or short pool
  pub is_long_pool: bool,
}