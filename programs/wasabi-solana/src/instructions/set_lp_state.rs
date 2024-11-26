use {
    crate::{
        error::ErrorCode,
        state::{GlobalSettings, Permission},
    },
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct LpState<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"global_settings"],
        bump,
    )]
    pub global_settings: Account<'info, GlobalSettings>,
    #[account(
        seeds = [b"super_admin"],
        bump,
        has_one = authority,
        constraint = super_admin.is_super_authority @ ErrorCode::InvalidPermissions
    )]
    pub super_admin: Account<'info, Permission>,
}

impl<'info> LpState<'info> {
    pub fn set_lp_state(&mut self, allow_lp: bool) -> Result<()> {
        match allow_lp {
            true => self.global_settings.enable_lping(),
            false => self.global_settings.disable_lping(),
        }
        Ok(())
    }
}
