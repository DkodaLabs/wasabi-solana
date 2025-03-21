use {
    crate::{
        error::ErrorCode, instructions::close_position_cleanup::*, utils::get_function_hash,
        StopLossOrder,
    },
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct StopLossCleanup<'info> {
    pub close_position_cleanup: ClosePositionCleanup<'info>,

    #[account(
      mut,
      seeds = [b"stop_loss_order", close_position_cleanup.position.key().as_ref()],
      bump,
    )]
    pub stop_loss_order: Account<'info, StopLossOrder>,
}

impl<'info> StopLossCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "stop_loss_cleanup")
    }

    pub fn stop_loss_cleanup(&mut self) -> Result<()> {
        let close_amounts = self
            .close_position_cleanup
            .close_position_cleanup(&CloseAction::ExitOrder(1))?;

        if self.close_position_cleanup.pool.is_long_pool {
            // Handle additional checks for a Stop Loss Order of a long pool

            // uint256 actualTakerAmount = closeAmounts.payout + closeAmounts.closeFee + closeAmounts.interestPaid + closeAmounts.principalRepaid;
            // if (actualTakerAmount > _order.takerAmount) revert PriceTargetNotReached();
            let payout_u128 = close_amounts.payout as u128;
            let actual_taker_amount = payout_u128
                .checked_add(close_amounts.close_fee as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?
                .checked_add(close_amounts.interest_paid as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?
                .checked_add(close_amounts.principal_repaid as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?
                .try_into()
                .map_err(|_| ErrorCode::U64Overflow)?;

            require_gte!(
                self.stop_loss_order.taker_amount,
                actual_taker_amount,
                ErrorCode::PriceTargetNotReached
            );
        } else {
            // Handle additional checks for a Take Profit Order of a short pool

            // if (actualMakerAmount * _order.takerAmount < _order.makerAmount * actualTakerAmount)
            // revert PriceTargetNotReached();

            // order price      = order.makerAmount / order.takerAmount
            // executed price   = actualMakerAmount / actualTakerAmount
            // SL: executed price >= order price
            //      actualMakerAmount / actualTakerAmount >= order.makerAmount / order.takerAmount
            //      actualMakerAmount * order.takerAmount >= order.makerAmount * actualTakerAmount
            let interest_paid_u128 = close_amounts.interest_paid as u128;
            let collateral_spent_u128 = close_amounts.collateral_spent as u128;
            let actual_taker_amount = interest_paid_u128
                .checked_add(close_amounts.principal_repaid as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
            let lhs = collateral_spent_u128
                .checked_mul(self.stop_loss_order.taker_amount as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
            let rhs = actual_taker_amount
                .checked_mul(self.stop_loss_order.maker_amount as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?;

            require_gte!(lhs, rhs, ErrorCode::PriceTargetNotReached);
        }

        self.stop_loss_order
            .close(self.close_position_cleanup.owner.to_account_info())?;

        Ok(())
    }
}
