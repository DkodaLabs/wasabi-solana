use {
    crate::{instructions::close_position_cleanup::*, utils::get_function_hash},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct LiquidatePositionCleanup<'info> {
    pub close_position_cleanup: ClosePositionCleanup<'info>,
}

impl<'info> LiquidatePositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "liquidate_position_cleanup")
    }

    pub fn liquidate_position_cleanup(&mut self) -> Result<()> {
        self.close_position_cleanup.close_position_cleanup(true)?;
        Ok(())
    }
}