use {
    crate::{Position, StopLossOrder},
    anchor_lang::prelude::*,
};

// Only Position's trader can invoke InitStopLossOrder.
// Limitation of 1 SL Order per Position. To modify, user must close the
// SL order and init a new one.

#[derive(Accounts)]
pub struct InitStopLossOrder<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,

    #[account(
        has_one = trader,
    )]
    pub position: Account<'info, Position>,

    #[account(
        init,
        payer = trader,
        seeds = [b"stop_loss_order", position.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<StopLossOrder>(),
    )]
    pub stop_loss_order: Account<'info, StopLossOrder>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct InitStopLossOrderArgs {
    maker_amount: u64,
    taker_amount: u64,
}

impl<'info> InitStopLossOrder<'info> {
    pub fn init_stop_loss_order(&mut self, args: &InitStopLossOrderArgs) -> Result<()> {
        self.stop_loss_order.set_inner(StopLossOrder {
            maker_amount: args.maker_amount,
            taker_amount: args.taker_amount,
            position: self.position.key(),
        });

        Ok(())
    }
}