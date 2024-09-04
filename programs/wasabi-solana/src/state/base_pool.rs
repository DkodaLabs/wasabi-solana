use anchor_lang::prelude::*;

// TODO add currency vault

#[account]
pub struct BasePool {
  /// The mint address for the collateral type this pool supports
  pub collateral: Pubkey,
  /// The token account address for holding the collateral (target currency) of this long pool
  pub collateral_vault: Pubkey,
  /// The token account address for holding the currency, which will be swapped.
  pub currency_vault: Pubkey,
  /// Flag to determine if it's a long or short pool
  pub is_long_pool: bool,
  /// The bump seed for this PDA
  pub bump: u8,
}
// The long pool needs to borrow SOL to buy WIF. Collateral is held in WIF, so the long pool needs 
//  a WIF token account to store that collateral.
// Need to make sure there is an LP Vault for the base currency

// The short pool needs to borrow WIF to buy SOL. Collateral is held in SOL (base currency), so 
//  the short pool needs a wSOL token account to store the collateral. 
