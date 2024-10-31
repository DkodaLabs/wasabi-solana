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

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SetMaxLeverageArgs {
    pub max_leverage: u64,
}

impl<'info> SetMaxLeverage<'info> {
    fn validate(&self, args: &SetMaxLeverageArgs) -> Result<()> {
        require_neq!(args.max_leverage, 0, ErrorCode::InvalidValue);
        require_gt!(
            100 * LEVERAGE_DENOMINATOR,
            args.max_leverage,
            ErrorCode::InvalidValue
        );
        Ok(())
    }

    pub fn set_max_leverage(&mut self, args: &SetMaxLeverageArgs) -> Result<()> {
        self.validate(args)?;

        self.debt_controller.max_leverage = args.max_leverage;

        Ok(())
    }
}