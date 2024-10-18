use {
    crate::{Position, TakeProfitOrder},
    anchor_lang::prelude::*,
};

// Only Position's trader can invoke InitTakeProfitOrder.
// Limitation of 1 TP Order per Position. To modify, user must close the
// TP order and init a new one.

#[derive(Accounts)]
pub struct InitTakeProfitOrder<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,

    #[account(
        has_one = trader,
    )]
    pub position: Account<'info, Position>,

    #[account(
        init,
        payer = trader,
        seeds = [b"take_profit_order", position.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<TakeProfitOrder>(),
    )]
    pub take_profit_order: Account<'info, TakeProfitOrder>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct InitTakeProfitOrderArgs {
    maker_amount: u64,
    taker_amount: u64,
}

impl<'info> InitTakeProfitOrder<'info> {
    pub fn init_take_profit_order(&mut self, args: &InitTakeProfitOrderArgs) -> Result<()> {
        self.take_profit_order.set_inner(TakeProfitOrder {
            maker_amount: args.maker_amount,
            taker_amount: args.taker_amount,
            position: self.position.key(),
        });

        Ok(())
    }
}

//pub fn handler(ctx: Context<InitTakeProfitOrder>, args: InitTakeProfitOrderArgs) -> Result<()> {
//    let take_profit_order = &mut ctx.accounts.take_profit_order;
//    take_profit_order.maker_amount = args.maker_amount;
//    take_profit_order.taker_amount = args.taker_amount;
//    take_profit_order.position = ctx.accounts.position.key();
//
//    Ok(())
//}
