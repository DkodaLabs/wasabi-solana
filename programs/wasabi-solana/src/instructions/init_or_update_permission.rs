use anchor_lang::prelude::*;

use crate::{AuthorityStatus, Permission, COSIGN_PERMISSION, INIT_VAULT_PERMISSION, LIQUIDATE_PERMISSION};

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
    status: AuthorityStatus,
    can_init_vaults: bool,
    can_liquidate: bool,
    can_cosign_swaps: bool,
}

impl InitOrUpdatePermissionArgs {
  pub fn permissions_map(&self) -> u8 {
    let mut res = 0;
    if self.can_init_vaults {
      res += INIT_VAULT_PERMISSION;
    }
    if self.can_liquidate {
      res += LIQUIDATE_PERMISSION;
    }
    if self.can_cosign_swaps {
      res += COSIGN_PERMISSION;
    }
    res
  }
}

pub fn handler(ctx: Context<InitOrUpdatePermission>, args: InitOrUpdatePermissionArgs) -> Result<()> {
    let permission = &mut ctx.accounts.permission;

    permission.authority = ctx.accounts.new_authority.key();
    permission.is_super_authority = false;
    permission.permissions_map = args.permissions_map();
    permission.status = args.status;
    Ok(())
}