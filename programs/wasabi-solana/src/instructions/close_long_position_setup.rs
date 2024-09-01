use anchor_lang::{prelude::*, solana_program::sysvar};
use anchor_spl::token::TokenAccount;

use crate::{BasePool, Position};

#[derive(Accounts)]
pub struct CloseLongPositionSetup<'info> {
  #[account(mut)]
  /// The wallet that owns the assets
  pub owner: Signer<'info>,
  /// The account that holds the owner's base currency
  pub owner_currency_account: Account<'info, TokenAccount>,

  #[account(
    has_one = collateral_vault,
  )]
  /// The LongPool that owns the Position
  pub long_pool: Account<'info, BasePool>,
  /// The collateral account that is the destination of the swap
  pub collateral_vault: Account<'info, TokenAccount>,

  #[account(mut)]
  pub position: Account<'info, Position>,

  #[account(
    address = sysvar::instructions::ID
  )]
  /// CHECK: Sysvar instruction check applied
  pub sysvar_info: AccountInfo<'info>,

}

pub fn handler(_ctx: Context<CloseLongPositionSetup>) -> Result<()> {
  // TODO: Transaction introspection
  // TODO: Pull the collateral from the LongPool vault
  // TODO: Create a close position request

  Ok(())
}