use {
    crate::{
        error::ErrorCode, instructions::close_position_cleanup::*, utils::get_function_hash,
        TakeProfitOrder,
    },
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct TakeProfitCleanup<'info> {
    pub close_position_cleanup: ClosePositionCleanup<'info>,

    #[account(
        mut,
        seeds = [b"take_profit_order", close_position_cleanup.position.key().as_ref()],
        bump,
    )]
    pub take_profit_order: Account<'info, TakeProfitOrder>,
}

impl<'info> TakeProfitCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "take_profit_cleanup")
    }

    pub fn take_profit_cleanup(&mut self) -> Result<()> {
        let close_amounts = self
            .close_position_cleanup
            .close_position_cleanup(&CloseAction::ExitOrder(0))?;
        if self.close_position_cleanup.pool.is_long_pool {
            // Handle additional checks for a Take Profit Order of a long pool

            // uint256 actualTakerAmount = closeAmounts.payout + closeAmounts.closeFee + closeAmounts.interestPaid + closeAmounts.principalRepaid;
            // if (actualTakerAmount < _order.takerAmount) revert PriceTargetNotReached();
            let payout_u128 = close_amounts.payout as u128;
            let target_amount: u64 = payout_u128
                .checked_add(close_amounts.close_fee as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?
                .checked_add(close_amounts.interest_paid as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?
                .checked_add(close_amounts.principal_repaid as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?
                .try_into()
                .map_err(|_| ErrorCode::U64Overflow)?;

            require_gte!(
                target_amount,
                self.take_profit_order.taker_amount,
                ErrorCode::PriceTargetNotReached
            );
        } else {
            // Handle additional checks for a Take Profit Order of a short pool

            // order price      = order.makerAmount / order.takerAmount
            // executed price   = actualMakerAmount / actualTakerAmount
            // TP: executed price <= order price
            //      actualMakerAmount / actualTakerAmount <= order.makerAmount / order.takerAmount
            //      actualMakerAmount * order.takerAmount <= order.makerAmount * actualTakerAmount
            let interest_paid_u128 = close_amounts.interest_paid as u128;
            let collateral_spent_u128 = close_amounts.collateral_spent as u128;

            let actual_taker_amount = interest_paid_u128
                .checked_add(close_amounts.principal_repaid as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
            let lhs = collateral_spent_u128
                .checked_mul(self.take_profit_order.taker_amount as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
            let rhs = actual_taker_amount
                .checked_mul(self.take_profit_order.maker_amount as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?;

            require_gte!(rhs, lhs, ErrorCode::PriceTargetNotReached);
        }

        self.take_profit_order
            .close(self.close_position_cleanup.owner.to_account_info())?;

        Ok(())
    }
}
