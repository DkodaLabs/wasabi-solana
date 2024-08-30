use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseLongPositionSetup<'info> {
  owner: Signer<'info>,

}

pub fn handler(_ctx: Context<CloseLongPositionSetup>) -> Result<()> {
  Ok(())
}