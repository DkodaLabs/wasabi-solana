use {
    crate::{state::Permission, AuthorityStatus},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct RemovePermission<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
        constraint = super_admin_permission.status == AuthorityStatus::Active,
        constraint = super_admin_permission.is_super_authority,
    )]
    pub super_admin_permission: Account<'info, Permission>,

    #[account(
        mut,
        close = authority,
        constraint = !permission.is_super_authority,
        constraint = permission.authority != super_admin_permission.key(),
    )]
    pub permission: Account<'info, Permission>,
}

impl<'info> RemovePermission<'info> {
    pub fn remove_permission(&mut self) -> Result<()> {
        Ok(())
    }
}
