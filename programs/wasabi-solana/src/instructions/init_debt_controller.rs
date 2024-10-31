use {
    crate::{state::DebtController, Permission},
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
    pub fn init_debt_controller(&mut self, max_apy: u64, max_leverage: u64) -> Result<()> {
        self.debt_controller.set_inner(DebtController {
            max_apy,
            max_leverage,
        });

        Ok(())
    }
}
