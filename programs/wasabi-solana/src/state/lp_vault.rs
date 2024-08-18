use anchor_lang::prelude::*;

#[account]
pub struct LpVault {
  /// Bump seed for the LpVault's PDA
  pub bump: u8,
  /// The SPL Mint address of the token that sits in this vault
  pub asset: Pubkey,
  /// The SPL Token account that stores the unborrowed tokens
  pub vault: Pubkey,
  /// The SPL Mint address that represents shares in the vault
  pub shares_mint: Pubkey,
  /// Count of the total assets owned by the vault, including tokens that are currently borrowed
  pub total_assets: u64,
}
