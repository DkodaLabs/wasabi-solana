use log::warn;
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
        let interest_earned = self.strategy.claim_yield(&self.lp_vault, new_quote)?;

        emit!(StrategyClaim {
            strategy: self.strategy.key(),
            vault_address: self.strategy.currency,
            collateral: self.collateral.key(),
            amount: interest_earned.try_into()?,
        });

        Ok(())
    }
}