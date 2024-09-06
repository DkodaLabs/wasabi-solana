use anchor_lang::prelude::*;

use crate::{
    instructions::close_position_cleanup::*, utils::get_function_hash,
};

#[derive(Accounts)]
pub struct CloseShortPositionCleanup<'info> {
    pub close_position_cleanup: ClosePositionCleanup<'info>,
}

impl<'info> CloseShortPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "close_short_position_cleanup")
    }
}

pub fn handler(ctx: Context<CloseShortPositionCleanup>) -> Result<()> {
    crate::instructions::close_position_cleanup::shared_position_cleanup(&mut ctx.accounts.close_position_cleanup)
}
