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

declare_id!("spicyfuhLBKM2ebrUF7jf59WDNgF7xXeLq62GyKnKrB");

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
        max_apy: u64,
        max_leverage: u64,
    ) -> Result<()> {
        ctx.accounts.init_debt_controller(max_apy, max_leverage)
    }

    #[access_control(SetSuperAdmin::validate(&ctx))]
    pub fn set_super_admin(ctx: Context<SetSuperAdmin>, new_super_admin: Pubkey) -> Result<()> {
        ctx.accounts.set_super_admin(new_super_admin)
    }

    #[access_control(TradingState::validate(&ctx))]
    pub fn set_trading_state(ctx: Context<TradingState>, allow_trading: bool) -> Result<()> {
        ctx.accounts.set_trading_state(allow_trading)
    }

    #[access_control(LpState::validate(&ctx))]
    pub fn set_lp_state(ctx: Context<LpState>, allow_lp: bool) -> Result<()> {
        ctx.accounts.set_lp_state(allow_lp)
    }

    pub fn set_max_apy(ctx: Context<SetMaxApy>, max_apy: u64) -> Result<()> {
        ctx.accounts.set_max_apy(max_apy)
    }

    pub fn set_max_leverage(ctx: Context<SetMaxLeverage>, max_leverage: u64) -> Result<()> {
        ctx.accounts.set_max_leverage(max_leverage)
    }

    pub fn init_or_update_permission(
        ctx: Context<InitOrUpdatePermission>,
        args: InitOrUpdatePermissionArgs,
    ) -> Result<()> {
        ctx.accounts.init_or_update_permission(&args)
    }

    #[access_control(InitLpVault::validate(&ctx))]
    pub fn init_lp_vault(ctx: Context<InitLpVault>, args: InitLpVaultArgs) -> Result<()> {
        ctx.accounts.init_lp_vault(&args, &ctx.bumps)
    }

    #[access_control(UpdateVaultMaxBorrow::validate(&ctx))]
    pub fn update_lp_vault_max_borrow(
        ctx: Context<UpdateVaultMaxBorrow>,
        max_borrow: u64,
    ) -> Result<()> {
        ctx.accounts.update_lp_vault_max_borrow(max_borrow)
    }

    #[access_control(AdminBorrow::validate(&ctx, amount))]
    pub fn admin_borrow(ctx: Context<AdminBorrow>, amount: u64) -> Result<()> {
        ctx.accounts.admin_borrow(amount)
    }

    #[access_control(Repay::validate(&ctx, amount))]
    pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
        ctx.accounts.repay(amount)
    }

    #[access_control(InitLongPool::validate(&ctx))]
    pub fn init_long_pool(ctx: Context<InitLongPool>) -> Result<()> {
        ctx.accounts.init_long_pool(&ctx.bumps)
    }

    #[access_control(InitShortPool::validate(&ctx))]
    pub fn init_short_pool(ctx: Context<InitShortPool>) -> Result<()> {
        ctx.accounts.init_short_pool(&ctx.bumps)
    }

    pub fn init_or_update_take_profit_order(
        ctx: Context<InitOrUpdateTakeProfitOrder>,
        maker_amount: u64,
        taker_amount: u64,
    ) -> Result<()> {
        ctx.accounts
            .init_or_update_take_profit_order(maker_amount, taker_amount)
    }

    pub fn close_take_profit_order(ctx: Context<CloseTakeProfitOrder>) -> Result<()> {
        ctx.accounts.close_take_profit_order()
    }

    pub fn init_or_update_stop_loss_order(
        ctx: Context<InitOrUpdateStopLossOrder>,
        maker_amount: u64,
        taker_amount: u64,
    ) -> Result<()> {
        ctx.accounts
            .init_or_update_stop_loss_order(maker_amount, taker_amount)
    }

    pub fn close_stop_loss_order(ctx: Context<CloseStopLossOrder>) -> Result<()> {
        ctx.accounts.close_stop_loss_order()
    }

    #[access_control(DepositOrWithdraw::validate(&ctx))]
    pub fn deposit(ctx: Context<DepositOrWithdraw>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

    pub fn withdraw(ctx: Context<DepositOrWithdraw>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)
    }

    #[access_control(DepositOrWithdraw::validate(&ctx))]
    pub fn mint(ctx: Context<DepositOrWithdraw>, shares_amount: u64) -> Result<()> {
        ctx.accounts.mint(shares_amount)
    }

    pub fn redeem(ctx: Context<DepositOrWithdraw>, shares_amount: u64) -> Result<()> {
        ctx.accounts.redeem(shares_amount)
    }

    #[access_control(Donate::validate(&ctx))]
    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        ctx.accounts.donate(amount)
    }

    #[access_control(OpenLongPositionSetup::validate(&ctx, expiration))]
    pub fn open_long_position_setup(
        ctx: Context<OpenLongPositionSetup>,
        nonce: u16,
        min_target_amount: u64,
        down_payment: u64,
        principal: u64,
        fee: u64,
        expiration: i64,
    ) -> Result<()> {
        ctx.accounts.open_long_position_setup(
            nonce,
            min_target_amount,
            down_payment,
            principal,
            fee,
            expiration,
        )
    }

    pub fn open_long_position_cleanup(ctx: Context<OpenLongPositionCleanup>) -> Result<()> {
        ctx.accounts.open_long_position_cleanup()
    }

    #[access_control(CloseLongPositionSetup::validate(&ctx, expiration))]
    pub fn close_long_position_setup(
        ctx: Context<CloseLongPositionSetup>,
        min_target_amount: u64,
        interest: u64,
        execution_fee: u64,
        expiration: i64,
    ) -> Result<()> {
        ctx.accounts.close_long_position_setup(
            min_target_amount,
            interest,
            execution_fee,
            expiration,
        )
    }

    pub fn close_long_position_cleanup(ctx: Context<CloseLongPositionCleanup>) -> Result<()> {
        ctx.accounts.close_long_position_cleanup()
    }

    #[access_control(OpenShortPositionSetup::validate(&ctx, expiration))]
    pub fn open_short_position_setup(
        ctx: Context<OpenShortPositionSetup>,
        nonce: u16,
        min_target_amount: u64,
        down_payment: u64,
        principal: u64,
        fee: u64,
        expiration: i64,
    ) -> Result<()> {
        ctx.accounts.open_short_position_setup(
            nonce,
            min_target_amount,
            down_payment,
            principal,
            fee,
            expiration,
        )
    }

    pub fn open_short_position_cleanup(ctx: Context<OpenShortPositionCleanup>) -> Result<()> {
        ctx.accounts.open_short_position_cleanup()
    }

    #[access_control(CloseShortPositionSetup::validate(&ctx, expiration))]
    pub fn close_short_position_setup(
        ctx: Context<CloseShortPositionSetup>,
        min_target_amount: u64,
        interest: u64,
        execution_fee: u64,
        expiration: i64,
    ) -> Result<()> {
        ctx.accounts.close_short_position_setup(
            min_target_amount,
            interest,
            execution_fee,
            expiration,
        )
    }

    pub fn close_short_position_cleanup(ctx: Context<CloseShortPositionCleanup>) -> Result<()> {
        ctx.accounts.close_short_position_cleanup()
    }

    #[access_control(LiquidatePositionSetup::validate(&ctx, expiration))]
    pub fn liquidate_position_setup(
        ctx: Context<LiquidatePositionSetup>,
        min_target_amount: u64,
        interest: u64,
        execution_fee: u64,
        expiration: i64,
    ) -> Result<()> {
        ctx.accounts.liquidate_position_setup(
            min_target_amount,
            interest,
            execution_fee,
            expiration,
        )
    }

    pub fn liquidate_position_cleanup(ctx: Context<LiquidatePositionCleanup>) -> Result<()> {
        ctx.accounts.liquidate_position_cleanup()
    }

    #[access_control(TakeProfitSetup::validate(&ctx, expiration))]
    pub fn take_profit_setup(
        ctx: Context<TakeProfitSetup>,
        min_target_amount: u64,
        interest: u64,
        execution_fee: u64,
        expiration: i64,
    ) -> Result<()> {
        ctx.accounts
            .take_profit_setup(min_target_amount, interest, execution_fee, expiration)
    }

    pub fn take_profit_cleanup(ctx: Context<TakeProfitCleanup>) -> Result<()> {
        ctx.accounts.take_profit_cleanup()
    }

    #[access_control(StopLossSetup::validate(&ctx, expiration))]
    pub fn stop_loss_setup(
        ctx: Context<StopLossSetup>,
        min_target_amount: u64,
        interest: u64,
        execution_fee: u64,
        expiration: i64,
    ) -> Result<()> {
        ctx.accounts
            .stop_loss_setup(min_target_amount, interest, execution_fee, expiration)
    }

    pub fn stop_loss_cleanup(ctx: Context<StopLossCleanup>) -> Result<()> {
        ctx.accounts.stop_loss_cleanup()
    }

    pub fn claim_position(ctx: Context<ClaimPosition>) -> Result<()> {
        ctx.accounts.claim_position()
    }
}
