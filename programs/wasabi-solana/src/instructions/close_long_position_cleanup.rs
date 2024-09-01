use anchor_lang::prelude::*;

use crate::utils::get_function_hash;

#[derive(Accounts)]
pub struct CloseLongPositionCleanup<'info> {
  owner: Signer<'info>,
  

}

impl<'info> CloseLongPositionCleanup<'info> {
  pub fn get_hash() -> [u8; 8] {
    get_function_hash("global", "close_long_position_cleanup")
}
}

pub fn handler(_ctx: Context<CloseLongPositionCleanup>) -> Result<()> {
  Ok(())
}