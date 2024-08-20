use anchor_lang::prelude::*;


#[account]
pub struct BasePool {
  /// The mint address for the collateral type this pool supports
  pub collateral: Pubkey,
  /// Flag to determine if it's a long or short pool
  pub is_long_pool: bool,
}
// The long pool needs to borrow SOL to buy WIF. Collateral is held in WIF, so the long pool needs 
//  a WIF token account to store that collateral.
// Need to make sure there is an LP Vault for the base currency

// The short pool needs to borrow WIF to buy SOL. Collateral is held in SOL (base currency), so 
//  the short pool needs a wSOL token account to store the collateral. 
