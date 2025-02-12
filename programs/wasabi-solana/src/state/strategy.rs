use crate::error::ErrorCode;
use crate::state::LpVault;
use anchor_lang::prelude::*;

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
    // amount of collateral held by the strategy
    pub collateral_amount: u64,
    // total_amount_borrowed + total cumulative interest
    pub total_borrowed_amount: u64,
    // `unix_timestamp` when the total_amount_borrowed was updated
    pub last_updated: i64,
}

impl Strategy {
    pub fn calculate_interest(&self, new_quote: u64) -> Result<u64> {
        if new_quote <= self.total_borrowed_amount {
            return Ok(self
                .total_borrowed_amount
                .checked_sub(new_quote)
                .ok_or(ErrorCode::ArithmeticUnderflow)?);
        }

        Ok(new_quote
            .checked_sub(self.total_borrowed_amount)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }

    pub fn claim_yield(&mut self, lp_vault: &mut Account<LpVault>, new_quote: u64) -> Result<i64> {
        let interest_earned = self.calculate_interest(new_quote)?;
        let mut interest_earned_i64 = interest_earned as i64;

        if new_quote <= self.total_borrowed_amount {
            self.total_borrowed_amount = self
                .total_borrowed_amount
                .checked_sub(interest_earned)
                .ok_or(ErrorCode::ArithmeticUnderflow)?;

            lp_vault.total_assets = lp_vault
                .total_assets
                .checked_sub(interest_earned)
                .ok_or(ErrorCode::ArithmeticUnderflow)?;

            lp_vault.total_borrowed = lp_vault
                .total_borrowed
                .checked_sub(interest_earned)
                .ok_or(ErrorCode::ArithmeticUnderflow)?;
            interest_earned_i64 *= -1i64;
        } else {
            self.total_borrowed_amount = self
                .total_borrowed_amount
                .checked_add(interest_earned)
                .ok_or(ErrorCode::ArithmeticOverflow)?;

            lp_vault.total_assets = lp_vault
                .total_assets
                .checked_add(interest_earned)
                .ok_or(ErrorCode::ArithmeticOverflow)?;

            lp_vault.total_borrowed = lp_vault
                .total_borrowed
                .checked_add(interest_earned)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        }

        Ok(interest_earned_i64)
    }
}