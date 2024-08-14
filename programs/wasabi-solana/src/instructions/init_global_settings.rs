use anchor_lang::prelude::*;

use crate::GlobalSettings;

#[derive(Accounts)]
pub struct InitGlobalSettings<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        seeds = [b"global_settings"],
        bump,
        space = 8 + std::mem::size_of::<GlobalSettings>()
    )]
    pub global_settings: Account<'info, GlobalSettings>,

    pub system_program: Program<'info, System>
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitGlobalSettingsArgs {
    fee_wallet: Pubkey,
    statuses: u8,
}

pub fn handler(_ctx: Context<InitGlobalSettings>, _args: InitGlobalSettingsArgs) -> Result<()> {
    todo!("Implement business logic");
    Ok(())
}
