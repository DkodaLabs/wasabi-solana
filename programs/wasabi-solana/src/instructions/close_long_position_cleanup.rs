use anchor_lang::prelude::*;

use crate::{
    instructions::close_position_cleanup::*, utils::get_function_hash,
};

#[derive(Accounts)]
pub struct CloseLongPositionCleanup<'info> {
    pub close_position_cleanup: ClosePositionCleanup<'info>,
}

impl<'info> CloseLongPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "close_long_position_cleanup")
    }
}

pub fn handler(ctx: Context<CloseLongPositionCleanup>) -> Result<()> {
    crate::instructions::close_position_cleanup::shared_position_cleanup(&mut ctx.accounts.close_position_cleanup)
}
