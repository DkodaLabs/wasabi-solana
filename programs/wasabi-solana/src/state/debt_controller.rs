use {crate::error::ErrorCode, anchor_lang::prelude::*};

const ONE_YEAR_IN_SECONDS: u64 = 31_536_000;
pub const APY_DENOMINATOR: u64 = 100;
pub const LEVERAGE_DENOMINATOR: u64 = 100;

#[account]
pub struct DebtController {
    pub max_apy: u64,
    pub max_leverage: u64,
    pub liquidation_fee: u8,
}

impl DebtController {
    pub fn compute_max_interest(
        &self,
        principal: u64,
        last_funding_timestamp: i64,
        now: i64,
    ) -> Result<u64> {
        // EVM logic:
        // uint256 secondsSince = block.timestamp - _lastFundingTimestamp;
        // maxInterestToPay = _principal * maxApy * secondsSince / (APY_DENOMINATOR * (365 days));
        let seconds_since = now - last_funding_timestamp;
        let seconds_since = seconds_since as u64;
        let max_interest_to_pay = principal
            .checked_mul(self.max_apy)
            .ok_or(ErrorCode::ArithmeticOverflow)?
            .checked_mul(seconds_since)
            .ok_or(ErrorCode::ArithmeticOverflow)?
            .checked_div(APY_DENOMINATOR * ONE_YEAR_IN_SECONDS)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        if max_interest_to_pay == 0 {
            Ok(1)
        } else {
            Ok(max_interest_to_pay)
        }
    }

    pub fn compute_max_principal(&self, down_payment: u64) -> Result<u64> {
        // EVM logic:
        // maxPrincipal = _downPayment * (maxLeverage - LEVERAGE_DENOMINATOR) / LEVERAGE_DENOMINATOR;
        let max_principal = down_payment
            .checked_mul(self.max_leverage - LEVERAGE_DENOMINATOR)
            .ok_or(ErrorCode::ArithmeticOverflow)?
            .checked_div(LEVERAGE_DENOMINATOR)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        Ok(max_principal)
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_max_interest() {
        let debt_controller = DebtController {
            max_apy: 100,
            max_leverage: 100,
            liquidation_fee: 5,
        };
        let principal = 1000;
        let last_funding_timestamp = 0;
        let now = 5;
        let max_interest = debt_controller
            .compute_max_interest(principal, last_funding_timestamp, now)
            .unwrap();
        // max_interest should always be a minimum of 1
        assert_eq!(max_interest, 1);
    }
}
