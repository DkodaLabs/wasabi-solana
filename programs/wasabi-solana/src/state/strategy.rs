use anchor_lang::prelude::*;
use crate::error::ErrorCode;

#[account]
pub struct Strategy {
    pub bump: u8,
    // the lp vault that was borrowed from
    pub lp_vault: Pubkey,
    // mint of the token that is being borrowed
    pub currency: Pubkey,
    // mint of the token that is being held as collateral - may not necessarily be a token
    pub collateral: Pubkey,
    // link to the token account holding the collateral
    pub collateral_vault: Pubkey,
    // total_amount_borrowed + total cumulative interest
    pub total_borrowed_amount: u64,
    // `unix_timestamp` when the total_amount_borrowed was updated
    pub last_updated: i64,
}

impl Strategy {
    pub fn calculate_interest(&self, new_quote: u64) -> Result<u64> {
        Ok(new_quote
            .checked_sub(self.total_borrowed_amount)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }
}