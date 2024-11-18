use {
    crate::{Position, TakeProfitOrder, events::ExitOrderCancelled},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct CloseTakeProfitOrder<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,

    #[account(
        has_one = trader,
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        close = trader,
        seeds = [b"take_profit_order", position.key().as_ref()],
        bump,
    )]
    pub take_profit_order: Account<'info, TakeProfitOrder>,
}

impl<'info> CloseTakeProfitOrder<'info> {
    pub fn close_take_profit_order(&self) -> Result<()> {
        emit!(ExitOrderCancelled {
            order_type: 0,
            position_id: self.position.key(),
        });

        Ok(())
    }
}
