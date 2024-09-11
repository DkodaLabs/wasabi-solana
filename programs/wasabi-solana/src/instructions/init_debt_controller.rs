use anchor_lang::prelude::*;

use crate::{state::DebtController, Permission};

#[derive(Accounts)]
pub struct InitDebtController<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
      has_one = authority,
      seeds = [b"super_admin"],
      bump,
    )]
    pub super_admin_permission: Account<'info, Permission>,

    #[account(init,  payer = authority, seeds = [b"debt_controller"], bump, space = 8 + std::mem::size_of::<DebtController>(),)]
    pub debt_controller: Account<'info, DebtController>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitDebtControllerArgs {
    pub max_apy: u64,
    pub max_leverage: u64,
}

pub fn handler(ctx: Context<InitDebtController>, args: InitDebtControllerArgs) -> Result<()> {
    let debt_controller = &mut ctx.accounts.debt_controller;
    debt_controller.max_apy = args.max_apy;
    debt_controller.max_leverage = args.max_leverage;
    Ok(())
}
