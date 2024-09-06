use anchor_lang::prelude::*;

use crate::{
    instructions::close_position_cleanup::*, utils::get_function_hash,
};

#[derive(Accounts)]
pub struct LiquidatePositionCleanup<'info> {
    pub close_position_cleanup: ClosePositionCleanup<'info>,
}

impl<'info> LiquidatePositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "liquidate_position_cleanup")
    }
}

pub fn handler(ctx: Context<LiquidatePositionCleanup>) -> Result<()> {
    crate::instructions::close_position_cleanup::shared_position_cleanup(&mut ctx.accounts.close_position_cleanup)
}
