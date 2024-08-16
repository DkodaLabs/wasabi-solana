use anchor_lang::prelude::*;

use crate::{AuthorityStatus, Permission};

#[derive(Accounts)]
pub struct InitOrUpdatePermission<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
      has_one = authority,
      constraint = super_admin_permission.status == AuthorityStatus::Active,
      constraint = super_admin_permission.is_super_authority,
      seeds = [b"super_admin"], 
      bump
  )]
  pub super_admin_permission: Account<'info, Permission>,

  #[account()]
  /// CHECK:
  pub new_authority: AccountInfo<'info>,

  #[account(
      init_if_needed,
      payer = payer,
      space = 8 + std::mem::size_of::<Permission>(),
      seeds = [b"admin", new_authority.key().as_ref()],   
      bump
  )]
  pub permission: Account<'info, Permission>,

  pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitOrUpdatePermissionArgs {
    permissions: u8,
}

pub fn handler(ctx: Context<InitOrUpdatePermission>, args: InitOrUpdatePermissionArgs) -> Result<()> {
    let permission = &mut ctx.accounts.permission;

    permission.authority = ctx.accounts.new_authority.key();
    permission.is_super_authority = false;
    permission.permissions_map = args.permissions;
    permission.status = AuthorityStatus::Active;
    Ok(())
}
