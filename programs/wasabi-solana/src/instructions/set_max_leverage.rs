use anchor_lang::prelude::*;

use crate::{DebtController, Permission};

#[derive(Accounts)]
pub struct SetMaxLeverage<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
      has_one = authority,
      seeds = [b"super_admin"],
      bump,
    )]
    pub super_admin_permission: Account<'info, Permission>,

    #[account(
      mut,
      seeds = [b"debt_controller"],
      bump,
    )]
    pub debt_controller: Account<'info, DebtController>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SetMaxLeverageArgs {
    pub max_leverage: u64,
}

pub fn handler(ctx: Context<SetMaxLeverage>, args: SetMaxLeverageArgs) -> Result<()> {
    let debt_controller = &mut ctx.accounts.debt_controller;
    debt_controller.max_leverage = args.max_leverage;
    Ok(())
}
        