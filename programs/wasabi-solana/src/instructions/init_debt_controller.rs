use {
    crate::{{state::DebtController, Permission}, error::ErrorCode, LEVERAGE_DENOMINATOR, APY_DENOMINATOR},
    anchor_lang::prelude::*,
};

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

    #[account(
        init,  
        payer = authority, 
        seeds = [b"debt_controller"], 
        bump, 
        space = 8 + std::mem::size_of::<DebtController>()
    )]
    pub debt_controller: Account<'info, DebtController>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitDebtController<'info> {
    fn validate(&self, max_apy: u64, max_leverage: u64, liquidation_fee: u8) -> Result<()> {
        require_neq!(max_apy, 0, ErrorCode::InvalidValue);
        require_gt!(
            1000 * APY_DENOMINATOR,
            max_apy,
            ErrorCode::InvalidValue
        );

        require_neq!(max_leverage, 0, ErrorCode::InvalidValue);
        require_gte!(
            100 * LEVERAGE_DENOMINATOR,
            max_leverage,
            ErrorCode::InvalidValue
        );

        require_neq!(liquidation_fee, 0, ErrorCode::InvalidValue);

        Ok(())
    }

    pub fn init_debt_controller(&mut self, max_apy: u64, max_leverage: u64, liquidation_fee: u8) -> Result<()> {
        self.validate(max_apy, max_leverage, liquidation_fee)?;
        self.debt_controller.set_inner(DebtController {
            max_apy,
            max_leverage,
            liquidation_fee,
        });

        Ok(())
    }
}
