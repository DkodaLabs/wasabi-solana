use {
    crate::{Position, StopLossOrder, events::ExitOrderCancelled},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct CloseStopLossOrder<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,

    #[account(
        has_one = trader,
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        close = trader,
        seeds = [b"stop_loss_order", position.key().as_ref()],
        bump,
    )]
    pub stop_loss_order: Account<'info, StopLossOrder>,
}

impl<'info> CloseStopLossOrder<'info> {
    pub fn close_stop_loss_order(&self) -> Result<()> {
        emit!(ExitOrderCancelled {
            order_type: 1,
            position_id: self.position.key(),
        });

        Ok(())
    }
}
