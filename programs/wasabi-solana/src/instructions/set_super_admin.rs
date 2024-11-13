use {
    crate::{error::ErrorCode, state::Permission},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct SetSuperAdmin<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority,
        seeds = [b"super_admin"],
        bump,
    )]
    pub super_admin_permission: Account<'info, Permission>,
}

impl<'info> SetSuperAdmin<'info> {
    pub fn validate(ctx: &Context<SetSuperAdmin>) -> Result<()> {
        require!(
            ctx.accounts.super_admin_permission.is_super_authority,
            ErrorCode::InvalidPermissions
        );
        require_keys_eq!(
            ctx.accounts.super_admin_permission.authority,
            ctx.accounts.authority.key(),
            ErrorCode::InvalidPermissions
        );
        Ok(())
    }

    pub fn set_super_admin(&mut self, new_super_admin: Pubkey) -> Result<()> {
        self.super_admin_permission.authority = new_super_admin;

        Ok(())
    }
}
