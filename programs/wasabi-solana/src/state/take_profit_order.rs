use anchor_lang::prelude::*;

#[account]
pub struct TakeProfitOrder {
  /// Position this Take Profit Order corresponds to
  pub position: Pubkey,
  /// The amount that will be sold from the position (is in `position.collateral_currency`)
  pub maker_amount: u64,
  /// The amount that will be bought to close the position (is in `position.currency`)
  pub taker_amount: u64,
}

// LONG
// TP: Must receive more than or equal to order.takerAmount
// if (actualTakerAmount < _order.takerAmount) revert PriceTargetNotReached();

// SHORT
// TP: executed price <= order price
// actualMakerAmount / actualTakerAmount <= order.makerAmount / order.takerAmount
// actualMakerAmount * order.takerAmount <= order.makerAmount * actualTakerAmount