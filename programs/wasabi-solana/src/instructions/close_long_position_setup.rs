use anchor_lang::{prelude::*, solana_program::sysvar};
use anchor_spl::token::TokenAccount;

use crate::{utils::position_setup_transaction_introspecation_validation, BasePool, ClosePositionRequest, Permission, Position};

use super::CloseLongPositionCleanup;

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

  pub authority: Signer<'info>,

  #[account(
    has_one = authority,
  )]
  pub permission: Account<'info, Permission>,

  #[account(
    init,
    payer = owner,
    seeds = [b"close_pos", owner.key().as_ref()],
    bump,
    space = 8 + std::mem::size_of::<ClosePositionRequest>(),
  )]
  pub close_position_request: Account<'info, ClosePositionRequest>,

  pub system_program: Program<'info, System>,
  #[account(
    address = sysvar::instructions::ID
  )]
  /// CHECK: Sysvar instruction check applied
  pub sysvar_info: AccountInfo<'info>,

}

impl<'info> CloseLongPositionSetup<'info> {
  pub fn validate(ctx: &Context<Self>, args: &CloseLongPositionArgs) -> Result<()> {
    // Validate TX only has only one setup IX and has one following cleanup IX
    position_setup_transaction_introspecation_validation(&ctx.accounts.sysvar_info, CloseLongPositionCleanup::get_hash())?;
    Ok(())
  }
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct CloseLongPositionArgs {
  /// The minimum amount out required when swapping
  pub min_target_amount: u64,
  /// The timestamp when this close position request expires.
  pub expiration: i64,
}


pub fn handler(_ctx: Context<CloseLongPositionSetup>, _args: CloseLongPositionArgs) -> Result<()> {
  // TODO: allow "owner" to swap on behalf of the collateral vault
  // TODO: Pull the collateral from the LongPool vault
  // TODO: Create a close position request

  Ok(())
}