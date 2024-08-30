use anchor_lang::prelude::*;

use crate::utils::get_function_hash;

#[derive(Accounts)]
pub struct OpenShortPositionCleanup {}

impl OpenShortPositionCleanup {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "open_long_position_cleanup")
    }
}

pub fn handler(ctx: Context<OpenShortPositionCleanup>) -> Result<()> {
    Ok(())
}
