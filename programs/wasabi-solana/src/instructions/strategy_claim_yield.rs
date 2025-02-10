use {
    crate::{error::ErrorCode, events::StrategyClaim, LpVault, Permission, Strategy},
    anchor_lang::prelude::*,
    anchor_spl::token_interface::TokenAccount,
};

#[derive(Accounts)]
pub struct StrategyClaimYield<'info> {
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
            b"strategy",
            lp_vault.key().as_ref(),
            collateral.key().as_ref()
        ],
        bump
    )]
    pub strategy: Account<'info, Strategy>,
}

impl<'info> StrategyClaimYield<'info> {
    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions
        );

        Ok(())
    }

    pub fn strategy_claim_yield(&mut self, new_quote: u64) -> Result<()> {
        let interest_earned = self.strategy.calculate_interest(new_quote)?;

        self.strategy.total_borrowed_amount = self
            .strategy
            .total_borrowed_amount
            .checked_add(interest_earned)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.lp_vault.total_assets = self
            .lp_vault
            .total_assets
            .checked_add(interest_earned)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.lp_vault.total_borrowed = self
            .lp_vault
            .total_borrowed
            .checked_add(interest_earned)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.strategy.last_updated = Clock::get()?.unix_timestamp;

        emit!(StrategyClaim {
            strategy: self.strategy.key(),
            vault_address: self.strategy.currency,
            collateral: self.collateral.key(),
            amount: interest_earned,
        });

        Ok(())
    }
}