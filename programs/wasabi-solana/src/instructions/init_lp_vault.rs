use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{Mint, Token, TokenAccount}};

use crate::{LpVault, Permission};

#[derive(Accounts)]
pub struct InitLpVault<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,
  /// The key that has permission to init the vault
  pub authority: Signer<'info>,

  #[account(
    has_one = authority,
  )]
  pub permission: Account<'info, Permission>,

  #[account(
    init,
    payer = payer,
    seeds = [b"lp_vault", asset_mint.key().as_ref()],
    bump,
    space = 8 + std::mem::size_of::<LpVault>(),
  )]
  pub lp_vault: Account<'info, LpVault>,

  pub asset_mint: Account<'info, Mint>,

  #[account(
    init,
    payer = payer,
    associated_token::mint = asset_mint,
    associated_token::authority = lp_vault,
  )]
  pub vault: Account<'info, TokenAccount>,

  #[account(
    init,
    payer = payer,
    seeds = [lp_vault.key().as_ref(), asset_mint.key().as_ref()],
    bump,
    mint::authority = lp_vault,
    mint::decimals = 6,

  )]
  pub shares_mint: Account<'info, Mint>,

  pub token_program: Program<'info, Token>,
  pub associated_token_program: Program<'info, AssociatedToken>,
  pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitLpVault>) -> Result<()> {
  let lp_vault: &mut Account<LpVault> = &mut ctx.accounts.lp_vault;

  lp_vault.bump = ctx.bumps.lp_vault;
  lp_vault.asset = ctx.accounts.asset_mint.key();
  lp_vault.vault = ctx.accounts.vault.key();
  lp_vault.shares_mint = ctx.accounts.shares_mint.key();
  lp_vault.total_assets = 0;
  Ok(())
}