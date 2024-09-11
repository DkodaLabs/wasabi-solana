use anchor_lang::prelude::*;

#[account]
pub struct DebtController {
  pub max_apy: u64,
  pub max_leverage: u64,
}

// pub impl DebtController {
//   pub fn 
// }