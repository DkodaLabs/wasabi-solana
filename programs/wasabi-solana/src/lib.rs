use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod instructions;
pub mod macros;
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

    #[access_control(InitLpVault::validate(&ctx))]
    pub fn init_lp_vault(ctx: Context<InitLpVault>) -> Result<()> {
        init_lp_vault::handler(ctx)
    }

    #[access_control(InitLongPool::validate(&ctx))]
    pub fn init_long_pool(ctx: Context<InitLongPool>) -> Result<()> {
        init_long_pool::handler(ctx)
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
}
