use {
    crate::{
        error::ErrorCode,
        state::{GlobalSettings, Permission, ProtocolWallet},
    },
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
#[instruction(wallet_type: u8, nonce: u8)]
pub struct GenerateWallet<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        seeds = [
            b"protocol_wallet", 
            global_settings.key().as_ref(), 
            &wallet_type.to_le_bytes(), &nonce.to_le_bytes()
        ],
        bump,
        space =  8 + std::mem::size_of::<ProtocolWallet>(),
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

impl<'info> GenerateWallet<'info> {
    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_manage_wallets(),
            ErrorCode::InvalidPermissions
        );
        Ok(())
    }

    pub fn generate_wallet(&mut self, wallet_type: u8, nonce: u8, bumps: &GenerateWalletBumps,) -> Result<()> {
        self.protocol_wallet.set_inner(ProtocolWallet {
            bump: bumps.protocol_wallet,
            nonce,
            wallet_type,
        });

        Ok(())
    }
}
