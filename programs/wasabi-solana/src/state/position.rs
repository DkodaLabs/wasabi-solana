use anchor_lang::prelude::*;

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
    pub fn compute_close_fee(&self, net_value: u64, is_long: bool) -> u64 {
        if is_long {
            //(self.principal + net_value) * self.fees_to_be_paid
            //    / (self.fees_to_be_paid + self.down_payment + self.principal)
            (self
                .principal
                .checked_add(net_value)
                .expect("overflow")
                .checked_mul(self.fees_to_be_paid)
                .expect("overflow"))
            .checked_div(
                self.fees_to_be_paid
                    .checked_add(self.down_payment)
                    .expect("overflow")
                    .checked_add(self.principal)
                    .expect("overflow"),
            )
            .expect("overflow")
        } else {
            //(self.collateral_amount + net_value) * self.fees_to_be_paid
            //    / (self.fees_to_be_paid + self.collateral_amount)
            (self
                .collateral_amount
                .checked_add(net_value)
                .expect("overflow")
                .checked_mul(self.fees_to_be_paid)
                .expect("overflow"))
            .checked_div(
                self.fees_to_be_paid
                    .checked_add(self.collateral_amount)
                    .expect("overflow"),
            )
            .expect("overflow")
        }
    }
}
