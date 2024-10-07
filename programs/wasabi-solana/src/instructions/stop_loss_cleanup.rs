use anchor_lang::prelude::*;

use crate::{
    error::ErrorCode, instructions::close_position_cleanup::*, utils::get_function_hash, StopLossOrder,
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
}

pub fn handler(ctx: Context<StopLossCleanup>) -> Result<()> {
    let close_amounts = crate::instructions::close_position_cleanup::shared_position_cleanup(
        &mut ctx.accounts.close_position_cleanup,
        false,
    )?;


    if ctx.accounts.close_position_cleanup.pool.is_long_pool {
      // Handle additional checks for a Stop Loss Order of a long pool

      // uint256 actualTakerAmount = closeAmounts.payout + closeAmounts.closeFee + closeAmounts.interestPaid + closeAmounts.principalRepaid;
      // if (actualTakerAmount > _order.takerAmount) revert PriceTargetNotReached();
      let actual_taker_amount = close_amounts.payout
      + close_amounts.close_fee
      + close_amounts.interest_paid
      + close_amounts.principal_repaid;
      msg!("TAKER AMOUNTS {:?} {:?}", actual_taker_amount, ctx.accounts.stop_loss_order.taker_amount);
      if actual_taker_amount > ctx.accounts.stop_loss_order.taker_amount {
          return Err(ErrorCode::PriceTargetNotReached.into());
      }
    } else {
      // Handle additional checks for a Take Profit Order of a short pool

      // if (actualMakerAmount * _order.takerAmount < _order.makerAmount * actualTakerAmount) 
                // revert PriceTargetNotReached();

      // order price      = order.makerAmount / order.takerAmount
      // executed price   = actualMakerAmount / actualTakerAmount
      // SL: executed price >= order price
        //      actualMakerAmount / actualTakerAmount >= order.makerAmount / order.takerAmount
        //      actualMakerAmount * order.takerAmount >= order.makerAmount * actualTakerAmount
      let actual_maker_amount = close_amounts.collateral_spent;
      let actual_taker_amount = close_amounts
          .interest_paid
          .checked_add(close_amounts.principal_repaid)
          .expect("overflow");
      let lhs = actual_maker_amount
          .checked_mul(ctx.accounts.stop_loss_order.taker_amount)
          .expect("overflow");
      let rhs = ctx
          .accounts
          .stop_loss_order
          .maker_amount
          .checked_mul(actual_taker_amount)
          .expect("overflow");
      if lhs < rhs {
          return Err(ErrorCode::PriceTargetNotReached.into());
      }
  }

    ctx.accounts
        .stop_loss_order
        .close(ctx.accounts.close_position_cleanup.owner.to_account_info())?;

    Ok(())
}