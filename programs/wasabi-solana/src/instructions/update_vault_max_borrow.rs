use anchor_lang::prelude::*;

use crate::{error::ErrorCode, LpVault, Permission};

#[derive(Accounts)]
pub struct UpdateVaultMaxBorrow<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,
  /// The key that has permission to init the vault
  pub authority: Signer<'info>,
  
  #[account(
    has_one = authority,
  )]
  pub permission: Account<'info, Permission>,

  #[account(mut)]
  pub lp_vault: Account<'info, LpVault>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateVaultMaxBorrowArgs {
  max_borrow: u64,
}

impl<'info> UpdateVaultMaxBorrow<'info> {
  pub fn validate(ctx: &Context<UpdateVaultMaxBorrow>) -> Result<()> {
    require!(ctx.accounts.permission.can_borrow_from_vault(), ErrorCode::InvalidPermissions);
    Ok(())
  }
}

pub fn handler(ctx: Context<UpdateVaultMaxBorrow>, args: UpdateVaultMaxBorrowArgs) -> Result<()> {
  let lp_vault = &mut ctx.accounts.lp_vault;
  lp_vault.max_borrow = args.max_borrow;
  Ok(())
}