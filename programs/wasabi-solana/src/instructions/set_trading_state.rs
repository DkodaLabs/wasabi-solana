use {
    crate::{
        error::ErrorCode,
        state::{GlobalSettings, Permission},
    },
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct TradingState<'info> {
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

impl<'info> TradingState<'info> {
    pub fn set_trading_state(&mut self, allow_trading: bool) -> Result<()> {
        match allow_trading {
            true => self.global_settings.enable_trading(),
            false => self.global_settings.disable_trading(),
        }
        Ok(())
    }
}
