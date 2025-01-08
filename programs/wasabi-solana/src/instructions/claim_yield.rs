use {
    crate::{NativeYield, LpVault},
    anchor_lang::prelude::*,
};

pub struct ClaimYield<'info> {
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

    #[account(
        mut, 
        seeds = [b"native_yield", lp_vault.key().as_ref()],
        bump
    )]
    pub native_yield: Acocunt<'info, NativeYield>,
}

impl<'info> ClaimYield<'info> {
    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        require!(ctx.accounts.permission.can_borrow_from_vaults(), ErrorCode::InvalidPermissions);

        Ok(())
    }

    pub fn claim_yield(&mut self, new_quote: u64) -> Result<()> {
        self.native_yield.total_amount_borrowed = self
            .native_yield
            .checked_add(
                self.native_yield
                    .calculate_interest(new_quote)?
            )
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.native_yield.last_updated = Clock::get()?;

        Ok(())
    }
}
