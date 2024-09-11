use anchor_lang::prelude::*;

use crate::{error::ErrorCode, state::DebtController, Permission};

#[derive(Accounts)]
pub struct SetMaxApy<'info> {
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
pub struct SetMaxApyArgs {
    pub max_apy: u64,
}

pub fn handler(ctx: Context<SetMaxApy>, args: SetMaxApyArgs) -> Result<()> {
    let debt_controller = &mut ctx.accounts.debt_controller;
    debt_controller.max_apy = args.max_apy;
    Ok(())
}