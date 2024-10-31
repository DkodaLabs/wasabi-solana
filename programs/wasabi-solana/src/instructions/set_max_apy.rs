use {
    crate::{error::ErrorCode, state::DebtController, Permission, APY_DENOMINATOR},
    anchor_lang::prelude::*,
};

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

impl<'info> SetMaxApy<'info> {
    fn validate(&self, max_apy: u64) -> Result<()> {
        require_neq!(max_apy, 0, ErrorCode::InvalidValue);
        require_gt!(
            1000 * APY_DENOMINATOR,
            max_apy,
            ErrorCode::InvalidValue
        );
        Ok(())
    }

    pub fn set_max_apy(&mut self, max_apy: u64) -> Result<()> {
        self.validate(max_apy)?;
        self.debt_controller.max_apy = max_apy;

        Ok(())
    }
}
