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

declare_id!("spicyTHtbmarmUxwFSHYpA8G4uP2nRNq38RReMpoZ9c");

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
        liquidation_fee: u8,
    ) -> Result<()> {
        ctx.accounts
            .init_debt_controller(max_apy, max_leverage, liquidation_fee)
    }

    #[access_control(SetSuperAdmin::validate(&ctx))]
    pub fn set_super_admin(ctx: Context<SetSuperAdmin>, new_super_admin: Pubkey) -> Result<()> {
        ctx.accounts.set_super_admin(new_super_admin)
    }

    pub fn set_trading_state(ctx: Context<TradingState>, allow_trading: bool) -> Result<()> {
        ctx.accounts.set_trading_state(allow_trading)
    }

    pub fn set_lp_state(ctx: Context<LpState>, allow_lp: bool) -> Result<()> {
        ctx.accounts.set_lp_state(allow_lp)
    }

    pub fn set_fee_wallet(ctx: Context<SetFeeWallet>, fee_wallet: Pubkey) -> Result<()> {
        ctx.accounts.set_fee_wallet(&fee_wallet)
    }

    pub fn set_liquidation_wallet(
        ctx: Context<SetLiquidationWallet>,
        liquidation_wallet: Pubkey,
    ) -> Result<()> {
        ctx.accounts.set_liquidation_wallet(&liquidation_wallet)
    }

    pub fn set_max_apy(ctx: Context<SetMaxApy>, max_apy: u64) -> Result<()> {
        ctx.accounts.set_max_apy(max_apy)
    }

    pub fn set_max_leverage(ctx: Context<SetMaxLeverage>, max_leverage: u64) -> Result<()> {
        ctx.accounts.set_max_leverage(max_leverage)
    }

    pub fn set_liquidation_fee(ctx: Context<SetLiqudationFee>, liquidation_fee: u8) -> Result<()> {
        ctx.accounts.set_liquidation_fee(liquidation_fee)
    }

    pub fn init_or_update_permission(
        ctx: Context<InitOrUpdatePermission>,
        args: InitOrUpdatePermissionArgs,
    ) -> Result<()> {
        ctx.accounts.init_or_update_permission(&args)
    }

    pub fn remove_permission(ctx: Context<RemovePermission>) -> Result<()> {
        ctx.accounts.remove_permission()
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

    #[access_control(DepositOrWithdraw::validate(&ctx, amount))]
    pub fn deposit(ctx: Context<DepositOrWithdraw>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

    pub fn withdraw(ctx: Context<DepositOrWithdraw>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)
    }

    pub fn redeem(ctx: Context<DepositOrWithdraw>, shares_amount: u64) -> Result<()> {
        ctx.accounts.redeem(shares_amount)
    }

    #[access_control(Donate::validate(&ctx, amount))]
    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        ctx.accounts.donate(amount)
    }

    #[access_control(OpenLongPositionSetup::validate(&ctx, expiration, false))]
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

    #[access_control(OpenLongPositionSetup::validate(&ctx, expiration, true))]
    pub fn open_long_position_setup_with_bundle(
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

    #[access_control(CloseLongPositionSetup::validate(&ctx, expiration, false))]
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

    #[access_control(CloseLongPositionSetup::validate(&ctx, expiration, true))]
    pub fn close_long_position_setup_with_bundle(
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

    #[access_control(OpenShortPositionSetup::validate(&ctx, expiration, false))]
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

    #[access_control(OpenShortPositionSetup::validate(&ctx, expiration, true))]
    pub fn open_short_position_setup_with_bundle(
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

    #[access_control(CloseShortPositionSetup::validate(&ctx, expiration, false))]
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

    #[access_control(CloseShortPositionSetup::validate(&ctx, expiration, true))]
    pub fn close_short_position_setup_with_bundle(
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

    #[access_control(LiquidatePositionSetup::validate(&ctx, expiration, false))]
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

    #[access_control(LiquidatePositionSetup::validate(&ctx, expiration, true))]
    pub fn liquidate_position_setup_with_bundle(
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

    #[access_control(TakeProfitSetup::validate(&ctx, expiration, false))]
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

    #[access_control(TakeProfitSetup::validate(&ctx, expiration, true))]
    pub fn take_profit_setup_with_bundle(
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

    #[access_control(StopLossSetup::validate(&ctx, expiration, false))]
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

    #[access_control(StopLossSetup::validate(&ctx, expiration, true))]
    pub fn stop_loss_setup_with_bundle(
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

    #[access_control(InitStrategy::validate(&ctx))]
    pub fn init_strategy(ctx: Context<InitStrategy>) -> Result<()> {
        ctx.accounts.init_strategy(&ctx.bumps)
    }

    #[access_control(StrategyDepositSetup::validate(&ctx, amount_in))]
    pub fn strategy_deposit_setup(
        ctx: Context<StrategyDepositSetup>,
        amount_in: u64,
        min_target_amount: u64,
    ) -> Result<()> {
        ctx.accounts
            .strategy_deposit_setup(amount_in, min_target_amount)
    }

    pub fn strategy_deposit_cleanup(ctx: Context<StrategyDepositCleanup>) -> Result<()> {
        ctx.accounts.strategy_deposit_cleanup()
    }

    #[access_control(StrategyWithdrawSetup::validate(&ctx, amount_in))]
    pub fn strategy_withdraw_setup(
        ctx: Context<StrategyWithdrawSetup>,
        amount_in: u64,
        min_target_amount: u64,
    ) -> Result<()> {
        ctx.accounts
            .strategy_withdraw_setup(amount_in, min_target_amount)
    }

    pub fn strategy_withdraw_cleanup(ctx: Context<StrategyWithdrawCleanup>) -> Result<()> {
        ctx.accounts.strategy_withdraw_cleanup()
    }

    #[access_control(CloseStrategy::validate(&ctx))]
    pub fn close_strategy(ctx: Context<CloseStrategy>) -> Result<()> {
        ctx.accounts.close_strategy()
    }

    #[access_control(StrategyClaimYield::validate(&ctx))]
    pub fn strategy_claim_yield(ctx: Context<StrategyClaimYield>, new_quote: u64) -> Result<()> {
        ctx.accounts.strategy_claim_yield(new_quote)
    }
}
