use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("DVmp8rZQHYSAo2h2SsXERvd85ks8wNUvfw33jLVWc2DX");

#[program]
pub mod wasabi_solana {
    use super::*;

    pub fn init_global_settings(
        ctx: Context<InitGlobalSettings>,
        args: InitGlobalSettingsArgs,
    ) -> Result<()> {
        init_global_settings::handler(ctx, args)
    }

    pub fn init_or_update_permission(
        ctx: Context<InitOrUpdatePermission>,
        args: InitOrUpdatePermissionArgs,
    ) -> Result<()> {
        init_or_update_permission::handler(ctx, args)
    }

    pub fn init_lp_vault(ctx: Context<InitLpVault>) -> Result<()> {
        init_lp_vault::handler(ctx)
    }
}
