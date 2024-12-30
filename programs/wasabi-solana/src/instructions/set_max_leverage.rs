use {
    crate::{error::ErrorCode, DebtController, Permission, LEVERAGE_DENOMINATOR},
    anchor_lang::prelude::*,
};

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

impl<'info> SetMaxLeverage<'info> {
    fn validate(&self, max_leverage: u64) -> Result<()> {
        require_neq!(max_leverage, 0, ErrorCode::InvalidValue);
        require_gte!(
             max_leverage,
            100 * LEVERAGE_DENOMINATOR,
            ErrorCode::InvalidValue
        );
        Ok(())
    }

    pub fn set_max_leverage(&mut self, max_leverage: u64) -> Result<()> {
        self.validate(max_leverage)?;

        self.debt_controller.max_leverage = max_leverage;

        Ok(())
    }
}
