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
