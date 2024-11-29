use {
    crate::{error::ErrorCode, state::DebtController, Permission},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct SetLiqudationFee<'info> {
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

impl<'info> SetLiqudationFee<'info> {
    fn validate(&self, liquidation_fee: u8) -> Result<()> {
        require_neq!(liquidation_fee, 0, ErrorCode::InvalidValue);

        Ok(())
    }

    pub fn set_liquidation_fee(&mut self, liquidation_fee: u8) -> Result<()> {
        self.validate(liquidation_fee)?;
        self.debt_controller.liquidation_fee = liquidation_fee;

        Ok(())
    }
}

