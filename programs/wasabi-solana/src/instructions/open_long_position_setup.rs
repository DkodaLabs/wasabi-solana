use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::{LpVault, OpenPositionRequest};

#[derive(Accounts)]
pub struct OpenLongPositionSetup<'info> {
  #[account(mut)]
  /// The wallet that owns the assets
  pub owner: Signer<'info>,
  /// The account that holds the owner's base currency
  pub owner_currency_account: Account<'info, TokenAccount>,
  /// The LP Vault that the user will borrow from
  #[account(
    has_one = vault,
  )]
  pub lp_vault: Account<'info, LpVault>,
  /// The LP Vault's token account.
  pub vault: Account<'info, TokenAccount>,

  #[account(
    init,
    payer = owner,
    seeds = [b"open_pos", owner.key().as_ref()],
    bump,
    space = 8 + std::mem::size_of::<OpenPositionRequest>(),
  )]
  pub open_position_request: Account<'info, OpenPositionRequest>,

  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct OpenLongPositionArgs {
  /// The minimum amount required when swapping
  pub min_amount_out: u64,
}

pub fn handler(_ctx: Context<OpenLongPositionSetup>, _args: OpenLongPositionArgs) -> Result<()> {
  todo!("implement");
  // TODO: Validate TX only has one setup IX
  // TODO: Validate TX only has one cleanup IX and it comes after this instruction
  // TODO: Valdiate the parameters and accounts
  // TODO: Borrow from the LP Vault
  // TODO: Consolidate the tokens into the user's token account (token transfer)
}