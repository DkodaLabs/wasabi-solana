use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseLongPositionCleanup<'info> {
  owner: Signer<'info>,
  

}

pub fn handler(_ctx: Context<CloseLongPositionCleanup>) -> Result<()> {
  Ok(())
}