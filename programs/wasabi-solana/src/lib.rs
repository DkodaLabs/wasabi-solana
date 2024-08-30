use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod macros;
pub mod state;
pub mod utils;

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

    #[access_control(InitLpVault::validate(&ctx))]
    pub fn init_lp_vault(ctx: Context<InitLpVault>) -> Result<()> {
        init_lp_vault::handler(ctx)
    }

    #[access_control(InitLongPool::validate(&ctx))]
    pub fn init_long_pool(ctx: Context<InitLongPool>) -> Result<()> {
        init_long_pool::handler(ctx)
    }

    #[access_control(InitShortPool::validate(&ctx))]
    pub fn init_short_pool(ctx: Context<InitShortPool>) -> Result<()> {
        init_short_pool::handler(ctx)
    }

    pub fn deposit(ctx: Context<DepositOrWithdraw>, args: DepositArgs) -> Result<()> {
        deposit::handler(ctx, args)
    }

    pub fn withdraw(ctx: Context<DepositOrWithdraw>, args: WithdrawArgs) -> Result<()> {
        withdraw::handler(ctx, args)
    }

    pub fn mint(ctx: Context<DepositOrWithdraw>, args: MintArgs) -> Result<()> {
        mint::handler(ctx, args)
    }

    pub fn redeem(ctx: Context<DepositOrWithdraw>, args: RedeemArgs) -> Result<()> {
        redeem::handler(ctx, args)
    }

    pub fn donate(ctx: Context<Donate>, args: DonateArgs) -> Result<()> {
        donate::handler(ctx, args)
    }

    #[access_control(OpenLongPositionSetup::validate(&ctx, &args))]
    pub fn open_long_position_setup(
        ctx: Context<OpenLongPositionSetup>,
        args: OpenLongPositionArgs,
    ) -> Result<()> {
        open_long_position_setup::handler(ctx, args)
    }

    pub fn open_long_position_cleanup(ctx: Context<OpenLongPositionCleanup>) -> Result<()> {
        open_long_position_cleanup::handler(ctx)
    }

    #[access_control(OpenShortPositionSetup::validate(&ctx, &args))]
    pub fn open_short_position_setup(
        ctx: Context<OpenShortPositionSetup>,
        args: OpenShortPositionArgs,
    ) -> Result<()> {
        open_short_position_setup::handler(ctx, args)
    }

    pub fn open_short_position_cleanup(ctx: Context<OpenShortPositionCleanup>) -> Result<()> {
        open_short_position_cleanup::handler(ctx)
    }
}
