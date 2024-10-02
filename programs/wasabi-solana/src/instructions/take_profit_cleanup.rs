use anchor_lang::prelude::*;

use crate::{
    error::ErrorCode, instructions::close_position_cleanup::*, utils::get_function_hash,
    TakeProfitOrder,
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
}

pub fn handler(ctx: Context<TakeProfitCleanup>) -> Result<()> {
    let close_amounts = crate::instructions::close_position_cleanup::shared_position_cleanup(
        &mut ctx.accounts.close_position_cleanup,
        true,
    )?;

    // uint256 actualTakerAmount = closeAmounts.payout + closeAmounts.closeFee + closeAmounts.interestPaid + closeAmounts.principalRepaid;
    // if (actualTakerAmount < _order.takerAmount) revert PriceTargetNotReached();
    let actual_taker_amount = close_amounts.payout
        + close_amounts.close_fee
        + close_amounts.interest_paid
        + close_amounts.principal_repaid;
    if actual_taker_amount < ctx.accounts.take_profit_order.min_amount_out {
        return Err(ErrorCode::PriceTargetNotReached.into());
    }

    Ok(())
}
