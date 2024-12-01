use {
    crate::{
        instructions::close_position_cleanup::*,  utils::get_function_hash,
    },
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct CloseShortPositionCleanup<'info> {
    pub close_position_cleanup: ClosePositionCleanup<'info>,

    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
}

impl<'info> CloseShortPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "close_short_position_cleanup")
    }

    pub fn close_short_position_cleanup(&mut self) -> Result<()> {
        self.close_position_cleanup
            .close_position_cleanup(&CloseAction::Market)?;
        Ok(())
    }
}
