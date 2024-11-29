use {
    crate::{error::ErrorCode, instructions::close_position_cleanup::*, utils::get_function_hash},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct LiquidatePositionCleanup<'info> {
    pub close_position_cleanup: ClosePositionCleanup<'info>,
}

impl<'info> LiquidatePositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "liquidate_position_cleanup")
    }

    fn validate_liquidation_threshold(&self, close_amounts: &CloseAmounts) -> Result<()> {
        if self.close_position_cleanup.pool.is_long_pool {
            require_gte!(
                self.close_position_cleanup
                    .position
                    .principal
                    .checked_mul(5)
                    .ok_or(ErrorCode::ArithmeticOverflow)?
                    .checked_div(100)
                    .ok_or(ErrorCode::ArithmeticOverflow)?,
                close_amounts
                    .payout
                    .checked_add(close_amounts.liquidation_fee)
                    .ok_or(ErrorCode::ArithmeticOverflow)?,
                ErrorCode::LiquidationThresholdNotReached,
            );
        } else {
            require_gte!(
                self.close_position_cleanup
                    .position
                    .collateral_amount
                    .checked_mul(5)
                    .ok_or(ErrorCode::ArithmeticOverflow)?
                    .checked_div(100)
                    .ok_or(ErrorCode::ArithmeticOverflow)?,
                close_amounts
                    .payout
                    .checked_add(close_amounts.liquidation_fee)
                    .ok_or(ErrorCode::ArithmeticOverflow)?,
                ErrorCode::LiquidationThresholdNotReached,
            );
        }
        Ok(())
    }

    pub fn liquidate_position_cleanup(&mut self) -> Result<()> {
        let close_amounts = self
            .close_position_cleanup
            .close_position_cleanup(&CloseAction::Liquidation)?;
        self.validate_liquidation_threshold(&close_amounts)?;
        Ok(())
    }
}
