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
        init_global_settings::handler(ctx, args)
    }

    pub fn init_debt_controller(
        ctx: Context<InitDebtController>,
        args: InitDebtControllerArgs,
    ) -> Result<()> {
        init_debt_controller::handler(ctx, args)
    }

    pub fn set_max_apy(
        ctx: Context<SetMaxApy>,
        args: SetMaxApyArgs,
    ) -> Result<()> {
        set_max_apy::handler(ctx, args)
    }

    pub fn set_max_leverage(
        ctx: Context<SetMaxLeverage>,
        args: SetMaxLeverageArgs,
    ) -> Result<()> {
        set_max_leverage::handler(ctx, args)
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

    pub fn init_take_profit_order(ctx: Context<InitTakeProfitOrder>, args: InitTakeProfitOrderArgs) -> Result<()> {
        init_take_profit_order::handler(ctx, args)
    }

    pub fn close_take_profit_order(ctx: Context<CloseTakeProfitOrder>) -> Result<()> {
        close_take_profit_order::handler(ctx)
    }

    pub fn init_stop_loss_order(ctx: Context<InitStopLossOrder>, args: InitStopLossOrderArgs) -> Result<()> {
        instructions::init_stop_loss_order::handler(ctx, args)
    }

    pub fn close_stop_loss_order(ctx: Context<CloseStopLossOrder>) -> Result<()> {
        instructions::close_stop_loss_order::handler(ctx)
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

    #[access_control(CloseLongPositionSetup::validate(&ctx, &args))]
    pub fn close_long_position_setup(
        ctx: Context<CloseLongPositionSetup>,
        args: instructions::close_position_setup::ClosePositionArgs,
    ) -> Result<()> {
        close_long_position_setup::handler(ctx, args)
    }

    pub fn close_long_position_cleanup(ctx: Context<CloseLongPositionCleanup>) -> Result<()> {
        close_long_position_cleanup::handler(ctx)
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

    #[access_control(CloseShortPositionSetup::validate(&ctx, &args))]
    pub fn close_short_position_setup(
        ctx: Context<CloseShortPositionSetup>,
        args: ClosePositionArgs,
    ) -> Result<()> {
        close_short_position_setup::handler(ctx, args)
    }

    pub fn close_short_position_cleanup(ctx: Context<CloseShortPositionCleanup>) -> Result<()> {
        close_short_position_cleanup::handler(ctx)
    }
    
    #[access_control(LiquidatePositionSetup::validate(&ctx, &args))]
    pub fn liquidate_position_setup(ctx: Context<LiquidatePositionSetup>, args: ClosePositionArgs) -> Result<()> {
        instructions::liquidate_position_setup::handler(ctx, args)
    }

    pub fn liquidate_position_cleanup(ctx: Context<LiquidatePositionCleanup>) -> Result<()> {
        instructions::liquidate_position_cleanup::handler(ctx)
    }

    #[access_control(TakeProfitSetup::validate(&ctx, &args))]
    pub fn take_profit_setup(ctx: Context<TakeProfitSetup>, args: ClosePositionArgs) -> Result<()> {
        instructions::take_profit_setup::handler(ctx, args)
    }

    pub fn take_profit_cleanup(ctx: Context<TakeProfitCleanup>) -> Result<()> {
        instructions::take_profit_cleanup::handler(ctx)
    }

    #[access_control(StopLossSetup::validate(&ctx, &args))]
    pub fn stop_loss_setup(ctx: Context<StopLossSetup>, args: ClosePositionArgs) -> Result<()> {
        instructions::stop_loss_setup::handler(ctx, args)
    }

    pub fn stop_loss_cleanup(ctx: Context<StopLossCleanup>) -> Result<()> {
        instructions::stop_loss_cleanup::handler(ctx)
    }

    pub fn claim_position(ctx: Context<ClaimPosition>, args: ClaimPositionArgs) -> Result<()> {
        instructions::claim_position::handler(ctx, args)
    }
}
