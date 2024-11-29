use {
    crate::{state::GlobalSettings, Permission},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct SetLiquidationWallet<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
        seeds = [b"super_admin"],
        bump,
    )]
    pub super_admin_permission: Account<'info, Permission>,

    #[account(
        mut,
        seeds = [b"global_settings"],
        bump,
    )]
    pub global_settings: Account<'info, GlobalSettings>,
}

impl<'info> SetLiquidationWallet<'info> {
    pub fn set_liquidation_wallet(&mut self, liquidation_wallet: &Pubkey) -> Result<()> {
        self.global_settings.liquidation_wallet = *liquidation_wallet;

        Ok(())
    }
}
