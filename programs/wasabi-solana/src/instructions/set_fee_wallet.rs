use {
    crate::{state::GlobalSettings, Permission},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct SetFeeWallet<'info> {
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

impl<'info> SetFeeWallet<'info> {
    pub fn set_fee_wallet(&mut self, fee_wallet: &Pubkey) -> Result<()> {
        self.global_settings.fee_wallet = *fee_wallet;

        Ok(())
    }
}
