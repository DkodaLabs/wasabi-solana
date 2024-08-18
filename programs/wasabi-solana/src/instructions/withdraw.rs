use anchor_lang::prelude::*;

use super::DepositOrWithdraw;

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct WithdrawArgs {
    pub shares_amount: u64,
}


pub fn handler(_ctx: Context<DepositOrWithdraw>, _args: WithdrawArgs) -> Result<()> {
  Ok(())
}