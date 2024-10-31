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

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SetMaxApyArgs {
    pub max_apy: u64,
}

impl<'info> SetMaxApy<'info> {
    fn validate(&self, args: &SetMaxApyArgs) -> Result<()> {
        require_neq!(args.max_apy, 0, ErrorCode::InvalidValue);
        require_gt!(
            1000 * APY_DENOMINATOR,
            args.max_apy,
            ErrorCode::InvalidValue
        );
        Ok(())
    }

    pub fn set_max_apy(&mut self, args: &SetMaxApyArgs) -> Result<()> {
        self.validate(&args)?;
        self.debt_controller.max_apy = args.max_apy;

        Ok(())
    }
}