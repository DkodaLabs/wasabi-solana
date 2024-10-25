use {
    crate::{AuthorityStatus, GlobalSettings, Permission},
    anchor_lang::prelude::*,
};

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

    #[account(
        init,
        payer = payer,
        seeds = [b"super_admin"],
        bump,
        space = 8 + std::mem::size_of::<Permission>()
    )]
    pub super_admin_permission: Account<'info, Permission>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitGlobalSettingsArgs {
    super_admin: Pubkey,
    fee_wallet: Pubkey,
    statuses: u16,
}

impl<'info> InitGlobalSettings<'info> {
    pub fn init_global_settings(&mut self, args: &InitGlobalSettingsArgs) -> Result<()> {
        self.global_settings.set_inner(GlobalSettings {
            protocol_fee_wallet: args.fee_wallet,
            statuses: args.statuses,
        });

        self.super_admin_permission.set_inner(Permission {
            authority: args.super_admin,
            status: AuthorityStatus::Active,
            is_super_authority: true,
            permissions_map: u8::MAX,
        });

        Ok(())
    }
}

//pub fn handler(ctx: Context<InitGlobalSettings>, args: InitGlobalSettingsArgs) -> Result<()> {
//    let global = &mut ctx.accounts.global_settings;
//    let super_admin_permission = &mut ctx.accounts.super_admin_permission;
//
//    global.protocol_fee_wallet = args.fee_wallet;
//    global.statuses = args.statuses;
//
//    super_admin_permission.authority = args.super_admin;
//    super_admin_permission.is_super_authority = true;
//    super_admin_permission.permissions_map = u8::MAX;
//    super_admin_permission.status = AuthorityStatus::Active;
//    Ok(())
//}
