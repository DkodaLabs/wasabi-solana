use {
    crate::{
        AuthorityStatus, Permission, COSIGN_PERMISSION, INIT_POOL_PERMISSION,
        INIT_VAULT_PERMISSION, LIQUIDATE_PERMISSION,
    },
    anchor_lang::prelude::*,
};

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
    can_init_pools: bool,
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
        if self.can_init_pools {
            res += INIT_POOL_PERMISSION
        }
        res
    }
}

impl<'info> InitOrUpdatePermission<'info> {
    pub fn init_or_update_permission(&mut self, args: &InitOrUpdatePermissionArgs) -> Result<()> {
        self.permission.set_inner(Permission {
            authority: self.new_authority.key(),
            is_super_authority: false,
            permissions_map: args.permissions_map(),
            status: args.status,
        });

        Ok(())
    }
}

