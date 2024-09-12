use anchor_lang::prelude::*;

const ONE_YEAR_IN_SECONDS: u64 = 31536000;
pub const APY_DENOMINATOR: u64 = 100;
pub const LEVERAGE_DENOMINATOR: u64 = 100;

#[account]
pub struct DebtController {
  pub max_apy: u64,
  pub max_leverage: u64,
}

impl DebtController {
  pub fn compute_max_interest(&self, principal: u64, last_funding_timestamp: i64) -> Result<u64> {
    // EVM logic:
    // uint256 secondsSince = block.timestamp - _lastFundingTimestamp;
    // maxInterestToPay = _principal * maxApy * secondsSince / (APY_DENOMINATOR * (365 days));
    let seconds_since = Clock::get()?.unix_timestamp - last_funding_timestamp;
    let seconds_since = seconds_since as u64;
    let max_interest_to_pay = principal.checked_mul(self.max_apy).expect("overflow").checked_mul(seconds_since).expect("overflow").checked_div(APY_DENOMINATOR * ONE_YEAR_IN_SECONDS).expect("overflow");
    Ok(max_interest_to_pay)
  }
  
  pub fn compute_max_principal(&self, down_payment: u64) -> u64 {
    msg!("down_payment {:?} max_leverage {:?}", down_payment, self.max_leverage);
    // EVM logic:
    // maxPrincipal = _downPayment * (maxLeverage - LEVERAGE_DENOMINATOR) / LEVERAGE_DENOMINATOR;
    let max_principal = down_payment.checked_mul(self.max_leverage - LEVERAGE_DENOMINATOR).expect("overflow").checked_div(LEVERAGE_DENOMINATOR).expect("overflow");
    max_principal
  }
}