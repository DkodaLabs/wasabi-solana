use anchor_lang::prelude::*;

use crate::{error::ErrorCode, DebtController, Permission, LEVERAGE_DENOMINATOR};

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

impl<'info> SetMaxLeverage<'info> {
    pub fn validate(&self, args: &SetMaxLeverageArgs) -> Result<()> {
        if args.max_leverage == 0 {
            return Err(ErrorCode::InvalidValue.into());
        }
        if args.max_leverage > 100 * LEVERAGE_DENOMINATOR {
            return Err(ErrorCode::InvalidValue.into());
        }
        Ok(())
    }
}

pub fn handler(ctx: Context<SetMaxLeverage>, args: SetMaxLeverageArgs) -> Result<()> {
    ctx.accounts.validate(&args)?;

    let debt_controller = &mut ctx.accounts.debt_controller;
    debt_controller.max_leverage = args.max_leverage;
    Ok(())
}
        