use {
    crate::{events::ExitOrder, Position, StopLossOrder},
    anchor_lang::prelude::*,
};

// Only Position's trader can invoke InitStopLossOrder.
// Limitation of 1 SL Order per Position.

#[derive(Accounts)]
pub struct InitOrUpdateStopLossOrder<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,

    #[account(
        has_one = trader,
    )]
    pub position: Account<'info, Position>,

    #[account(
        init_if_needed,
        payer = trader,
        seeds = [b"stop_loss_order", position.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<StopLossOrder>(),
    )]
    pub stop_loss_order: Account<'info, StopLossOrder>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitOrUpdateStopLossOrder<'info> {
    pub fn init_or_update_stop_loss_order(
        &mut self,
        maker_amount: u64,
        taker_amount: u64,
    ) -> Result<()> {
        self.stop_loss_order.set_inner(StopLossOrder {
            maker_amount,
            taker_amount,
            position: self.position.key(),
        });

        emit!(ExitOrder {
            order_type: 1,
            position_id: self.position.key(),
            maker_amount,
            taker_amount,
        });

        Ok(())
    }
}
