use anchor_lang::prelude::*;

use super::DepositOrWithdraw;

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct MintArgs {
    pub shares_amount: u64,
}

pub fn handler(ctx: Context<DepositOrWithdraw>, args: MintArgs) -> Result<()> {
    Ok(())
}
