use {crate::error::ErrorCode, anchor_lang::prelude::*};

#[account]
pub struct Position {
    /// Wallet that opened the position
    pub trader: Pubkey,
    /// The address of the currency to be paid for the position.
    pub currency: Pubkey,
    /// The address of the currency to be received for the position.
    pub collateral: Pubkey,
    /// The timestamp of the last funding payment.
    pub last_funding_timestamp: i64,
    /// The initial down payment amount required to open the position (is in `currency` for long, `collateralCurrency` for short positions)
    /// i.e. It is always in the quote currency
    pub down_payment: u64,
    /// The total principal amount to be borrowed for the position (is in `currency`)
    pub principal: u64,
    /// The total collateral amount to be received for the position (is in `collateralCurrency`)
    pub collateral_amount: u64,
    /// The total fees to be paid for the position (is in `currency`)
    pub fees_to_be_paid: u64,
    /// Link to the token account that is holding the collateral
    pub collateral_vault: Pubkey,
    // Link to the LP Vault that the Position borrowed from.
    pub lp_vault: Pubkey,
}

impl Position {
    pub fn compute_close_fee(&self, net_value: u64, is_long: bool) -> Result<u64> {
        let net_value_u128 = net_value as u128;
        let fees_to_be_paid_u128 = self.fees_to_be_paid as u128;

        if is_long {
            let down_payment_u128 = self.down_payment as u128;
            let principal_u128 = self.principal as u128;
            //(self.principal + net_value) * self.fees_to_be_paid
            //    / (self.fees_to_be_paid + self.down_payment + self.principal)
            Ok(principal
                .checked_mul(fees_to_be_paid_u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?
                .checked_div(
                    fees_to_be_paid_u128
                        .checked_add(down_payment_u128)
                        .ok_or(ErrorCode::ArithmeticOverflow)?
                        .checked_add(principal_u128)
                        .ok_or(ErrorCode::ArithmeticOverflow)?,
                )
                .ok_or(ErrorCode::ArithmeticOverflow)?)
            .try_into()
            .map_err(|_| ErrorCode::U64Overflow)?
            //Ok(self
            //   .principal
            //   .checked_add(net_value)
            //   .ok_or(ErrorCode::ArithmeticOverflow)?
            //   .checked_mul(self.fees_to_be_paid)
            //   .ok_or(ErrorCode::ArithmeticOverflow)?
            //   .checked_div(
            //       self.fees_to_be_paid
            //           .checked_add(self.down_payment)
            //           .ok_or(ErrorCode::ArithmeticOverflow)?
            //           .checked_add(self.principal)
            //           .ok_or(ErrorCode::ArithmeticOverflow)?,
            //   )
            //   .ok_or(ErrorCode::ArithmeticOverflow)?)
        } else {
            let collateral_amount_u128 = self.colateral_amount as u128;
            //(self.collateral_amount + net_value) * self.fees_to_be_paid
            //    / (self.fees_to_be_paid + self.collateral_amount)
            Ok(collateral_amount_u128
                .checked_add(net_value_u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?
                .checked_mul(fees_to_be_paid_u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?
                .checked_div(
                    fees_to_be_paid_u128
                        .checked_add(collateral_amount_u128)
                        .ok_or(ErrorCode::ArithmeticOverflow)?,
                )
                .ok_or(ErrorCode::ArithmeticOverflow)?)
            .try_into()
            .map_err(|_| ErrorCode::U64Overflow)?
            //Ok(self
            //    .collateral_amount
            //    .checked_add(net_value)
            //    .ok_or(ErrorCode::ArithmeticOverflow)?
            //    .checked_mul(self.fees_to_be_paid)
            //    .ok_or(ErrorCode::ArithmeticOverflow)?
            //    .checked_div(
            //        self.fees_to_be_paid
            //            .checked_add(self.collateral_amount)
            //            .ok_or(ErrorCode::ArithmeticOverflow)?,
            //    )
            //    .ok_or(ErrorCode::ArithmeticOverflow)?)
        }
    }
}
