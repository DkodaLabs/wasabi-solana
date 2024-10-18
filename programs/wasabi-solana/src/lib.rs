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

declare_id!("FL1XKFr8ZMDdEJxHDR16SJaiGyLZTk9BHFUDenGr5HEp");

#[program]
pub mod wasabi_solana {
    use super::*;

    pub fn init_global_settings(
        ctx: Context<InitGlobalSettings>,
        args: InitGlobalSettingsArgs,
    ) -> Result<()> {
        ctx.accounts.init_global_settings(&args)
    }

    pub fn init_debt_controller(
        ctx: Context<InitDebtController>,
        args: InitDebtControllerArgs,
    ) -> Result<()> {
        ctx.accounts.init_debt_controller(&args)
    }

    pub fn set_max_apy(ctx: Context<SetMaxApy>, args: SetMaxApyArgs) -> Result<()> {
        ctx.accounts.set_max_apy(&args)
    }

    pub fn set_max_leverage(ctx: Context<SetMaxLeverage>, args: SetMaxLeverageArgs) -> Result<()> {
        ctx.accounts.set_max_leverage(&args)
    }

    pub fn init_or_update_permission(
        ctx: Context<InitOrUpdatePermission>,
        args: InitOrUpdatePermissionArgs,
    ) -> Result<()> {
        ctx.accounts.init_or_update_permission(&args)
    }

    #[access_control(InitLpVault::validate(&ctx))]
    pub fn init_lp_vault(ctx: Context<InitLpVault>) -> Result<()> {
        ctx.accounts.init_lp_vault(&ctx.bumps)
    }

    #[access_control(UpdateVaultMaxBorrow::validate(&ctx))]
    pub fn update_lp_vault_max_borrow(
        ctx: Context<UpdateVaultMaxBorrow>,
        args: UpdateVaultMaxBorrowArgs,
    ) -> Result<()> {
        ctx.accounts.update_lp_vault_max_borrow(&args)
    }

    #[access_control(AdminBorrow::validate(&ctx, amount))]
    pub fn admin_borrow(ctx: Context<AdminBorrow>, amount: u64) -> Result<()> {
        ctx.accounts.admin_borrow(amount)
    }

    #[access_control(Repay::validate(&ctx, &args))]
    pub fn repay(ctx: Context<Repay>, args: RepayArgs) -> Result<()> {
        ctx.accounts.repay(&args)
    }

    #[access_control(InitLongPool::validate(&ctx))]
    pub fn init_long_pool(ctx: Context<InitLongPool>) -> Result<()> {
        ctx.accounts.init_long_pool(&ctx.bumps)
    }

    #[access_control(InitShortPool::validate(&ctx))]
    pub fn init_short_pool(ctx: Context<InitShortPool>) -> Result<()> {
        ctx.accounts.init_short_pool(&ctx.bumps)
    }

    pub fn init_take_profit_order(
        ctx: Context<InitTakeProfitOrder>,
        args: InitTakeProfitOrderArgs,
    ) -> Result<()> {
        ctx.accounts.init_take_profit_order(&args)
    }

    pub fn close_take_profit_order(ctx: Context<CloseTakeProfitOrder>) -> Result<()> {
        ctx.accounts.close_take_profit_order()
    }

    pub fn init_stop_loss_order(
        ctx: Context<InitStopLossOrder>,
        args: InitStopLossOrderArgs,
    ) -> Result<()> {
        ctx.accounts.init_stop_loss_order(&args)
    }

    pub fn close_stop_loss_order(ctx: Context<CloseStopLossOrder>) -> Result<()> {
        ctx.accounts.close_stop_loss_order()
    }

    pub fn deposit(ctx: Context<DepositOrWithdraw>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

    pub fn withdraw(ctx: Context<DepositOrWithdraw>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)
    }

    pub fn mint(ctx: Context<DepositOrWithdraw>, amount: u64) -> Result<()> {
        ctx.accounts.mint(amount)
    }

    pub fn redeem(ctx: Context<DepositOrWithdraw>, amount: u64) -> Result<()> {
        ctx.accounts.redeem(amount)
    }

    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        ctx.accounts.donate(amount)
    }

    // Maybe remove the `&ctx`
    #[access_control(OpenLongPositionSetup::validate(&ctx, &args))]
    pub fn open_long_position_setup(
        ctx: Context<OpenLongPositionSetup>,
        args: OpenLongPositionArgs,
    ) -> Result<()> {
        ctx.accounts.open_long_position_setup(&args)
    }

    pub fn open_long_position_cleanup(ctx: Context<OpenLongPositionCleanup>) -> Result<()> {
        ctx.accounts.open_long_position_cleanup()
    }

    #[access_control(CloseLongPositionSetup::validate(&ctx, &args))]
    pub fn close_long_position_setup(
        ctx: Context<CloseLongPositionSetup>,
        args: instructions::close_position_setup::ClosePositionArgs,
    ) -> Result<()> {
        ctx.accounts.close_long_position_setup(&args)
    }

    pub fn close_long_position_cleanup(ctx: Context<CloseLongPositionCleanup>) -> Result<()> {
        ctx.accounts.close_long_position_cleanup()
    }

    #[access_control(OpenShortPositionSetup::validate(&ctx, &args))]
    pub fn open_short_position_setup(
        ctx: Context<OpenShortPositionSetup>,
        args: OpenShortPositionArgs,
    ) -> Result<()> {
        ctx.accounts.open_short_position_setup(&args)
    }

    pub fn open_short_position_cleanup(ctx: Context<OpenShortPositionCleanup>) -> Result<()> {
        ctx.accounts.open_short_position_cleanup()
    }

    #[access_control(CloseShortPositionSetup::validate(&ctx, &args))]
    pub fn close_short_position_setup(
        ctx: Context<CloseShortPositionSetup>,
        args: ClosePositionArgs,
    ) -> Result<()> {
        ctx.accounts.close_short_position_setup(&args)
    }

    pub fn close_short_position_cleanup(ctx: Context<CloseShortPositionCleanup>) -> Result<()> {
        ctx.accounts.close_short_position_cleanup()
    }

    #[access_control(LiquidatePositionSetup::validate(&ctx, &args))]
    pub fn liquidate_position_setup(
        ctx: Context<LiquidatePositionSetup>,
        args: ClosePositionArgs,
    ) -> Result<()> {
        ctx.accounts.liquidate_position_setup(&args)
    }

    pub fn liquidate_position_cleanup(ctx: Context<LiquidatePositionCleanup>) -> Result<()> {
        ctx.accounts.liquidate_position_cleanup()
    }

    #[access_control(TakeProfitSetup::validate(&ctx, &args))]
    pub fn take_profit_setup(ctx: Context<TakeProfitSetup>, args: ClosePositionArgs) -> Result<()> {
        ctx.accounts.take_profit_setup(&args)
    }

    pub fn take_profit_cleanup(ctx: Context<TakeProfitCleanup>) -> Result<()> {
        ctx.accounts.take_profit_cleanup()
    }

    #[access_control(StopLossSetup::validate(&ctx, &args))]
    pub fn stop_loss_setup(ctx: Context<StopLossSetup>, args: ClosePositionArgs) -> Result<()> {
        ctx.accounts.stop_loss_setup(&args)
    }

    pub fn stop_loss_cleanup(ctx: Context<StopLossCleanup>) -> Result<()> {
        ctx.accounts.stop_loss_cleanup()
    }

    pub fn claim_position(ctx: Context<ClaimPosition>) -> Result<()> {
        ctx.accounts.claim_position()
    }
}
