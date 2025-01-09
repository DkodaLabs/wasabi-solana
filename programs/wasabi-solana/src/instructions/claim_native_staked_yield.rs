use {
    crate::{error::ErrorCode, LpVault, NativeYield, Permission},
    anchor_lang::prelude::*,
    anchor_spl::token_interface::TokenAccount,
};

#[derive(Accounts)]
pub struct ClaimNativeStakedYield<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

    #[account(mut)]
    pub lp_vault: Account<'info, LpVault>,

    pub collateral: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        has_one = collateral,
        has_one = lp_vault,
        seeds = [
            b"native_yield", 
            lp_vault.key().as_ref(), 
            collateral.key().as_ref()
        ],
        bump
    )]
    pub native_yield: Account<'info, NativeYield>,
}

impl<'info> ClaimNativeStakedYield<'info> {
    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions
        );

        Ok(())
    }

    pub fn claim_native_staked_yield(&mut self, new_quote: u64) -> Result<()> {
        let interest_earned = self.native_yield.calculate_interest(new_quote)?;

        self.native_yield.total_borrowed_amount = self
            .native_yield
            .total_borrowed_amount
            .checked_add(interest_earned)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.lp_vault.total_assets = self
            .lp_vault
            .total_assets
            .checked_add(interest_earned)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.lp_vault.total_borrowed = self
            .lp_vault.total_borrowed
            .checked_add(interest_earned)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.native_yield.last_updated = Clock::get()?.unix_timestamp;

        Ok(())
    }
}
