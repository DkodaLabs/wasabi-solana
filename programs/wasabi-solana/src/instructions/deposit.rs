use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::LpVault;

#[derive(Accounts)]
pub struct Deposit<'info> {
  /// The key of the user that owns the assets
  pub owner: Signer<'info>,

  #[account(mut)]
  /// The Owner's tokena account that holds the assets
  pub owner_asset_account: Account<'info, TokenAccount>,

  #[account(mut)]
  /// The Owner's token account that stores share tokens
  pub owner_shares_account: Account<'info, TokenAccount>,

  #[account(
    mut,
    has_one = vault,
    has_one = shares_mint,
  )]
  pub lp_vault: Account<'info, LpVault>,

  #[account(mut)]
  pub vault: Account<'info, TokenAccount>,

  #[account(mut)]
  pub shares_mint: Account<'info, Mint>,

  pub token_program: Program<'info, Token>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct DepositArgs {
  /// The amount of assets to deposit
  amount: u64,
}

pub fn handler(_ctx: Context<Deposit>, _args: DepositArgs) -> Result<()> {
  // TODO: transfer tokens from user's asset account
  // TODO: Mint share tokens to the user
  // TODO: Update the LpVault for total assets deposited.
  Ok(())
}