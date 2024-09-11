use anchor_lang::prelude::*;

use crate::{error::ErrorCode, state::DebtController, Permission, APY_DENOMINATOR};

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

impl<'info> SetMaxApy<'info> {
    pub fn validate(&self, args: &SetMaxApyArgs) -> Result<()> {
        if args.max_apy == 0 {
            return Err(ErrorCode::InvalidValue.into());
        }
        if args.max_apy > 1000 * APY_DENOMINATOR {
            return Err(ErrorCode::InvalidValue.into());
        }
        Ok(())
    }
}

pub fn handler(ctx: Context<SetMaxApy>, args: SetMaxApyArgs) -> Result<()> {
    ctx.accounts.validate(&args)?;

    let debt_controller = &mut ctx.accounts.debt_controller;
    debt_controller.max_apy = args.max_apy;
    Ok(())
}