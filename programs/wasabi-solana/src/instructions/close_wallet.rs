use {
    crate::{
        error::ErrorCode,
        state::{GlobalSettings, Permission, ProtocolWallet},
    },
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct CloseWallet<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        close = authority,
        owner = crate::ID,
        seeds = [
            b"protocol_wallet",
            global_settings.key().as_ref(),
            &protocol_wallet.wallet_type.to_le_bytes(),
            &protocol_wallet.nonce.to_le_bytes(),
        ],
        bump = protocol_wallet.bump,
    )]
    pub protocol_wallet: Account<'info, ProtocolWallet>,

    #[account(
        has_one = authority
    )]
    pub permission: Account<'info, Permission>,

    #[account(
        seeds = [b"global_settings"],
        bump,
    )]
    pub global_settings: Account<'info, GlobalSettings>,

    pub system_program: Program<'info, System>,
}

impl<'info> CloseWallet<'info> {
    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_manage_wallets(),
            ErrorCode::InvalidPermissions
        );
        Ok(())
    }

    pub fn close_wallet(&mut self) -> Result<()> {
        Ok(())
    }
}
