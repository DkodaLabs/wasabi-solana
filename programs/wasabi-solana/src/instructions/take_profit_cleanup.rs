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
        let close_amounts = self.close_position_cleanup.close_position_cleanup(false)?;
        if self.close_position_cleanup.pool.is_long_pool {
            // Handle additional checks for a Take Profit Order of a long pool

            // uint256 actualTakerAmount = closeAmounts.payout + closeAmounts.closeFee + closeAmounts.interestPaid + closeAmounts.principalRepaid;
            // if (actualTakerAmount < _order.takerAmount) revert PriceTargetNotReached();
            require_gt!(
                close_amounts
                    .payout
                    .checked_add(close_amounts.close_fee)
                    .expect("overflow")
                    .checked_add(close_amounts.interest_paid)
                    .expect("overflow")
                    .checked_add(close_amounts.principal_repaid)
                    .expect("overflow"),
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

            let actual_taker_amount = close_amounts
                .interest_paid
                .checked_add(close_amounts.principal_repaid)
                .expect("overflow");
            let lhs = close_amounts
                .collateral_spent
                .checked_mul(self.take_profit_order.taker_amount)
                .expect("overflow");
            let rhs = self
                .take_profit_order
                .maker_amount
                .checked_mul(actual_taker_amount)
                .expect("overflow");

            require_gt!(rhs, lhs, ErrorCode::PriceTargetNotReached);
        }

        self.take_profit_order
            .close(self.close_position_cleanup.owner.to_account_info())?;

        Ok(())
    }
}