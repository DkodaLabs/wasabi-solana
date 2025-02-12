use {
    crate::{
        error::ErrorCode,
        events::StrategyClaim,
        state::{LpVault, Permission, Strategy},
        utils::get_shares_mint_address,
    },
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::get_associated_token_address_with_program_id,
        token_interface::TokenAccount,
    },
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
        let interest_earned = self.strategy.claim_yield(&mut self.lp_vault, new_quote)?;

        emit!(StrategyClaim {
            strategy: self.strategy.key(),
            vault_address: get_shares_mint_address(&self.lp_vault.key(), &self.strategy.currency),
            collateral: self.collateral.key(),
            amount: interest_earned.try_into()?,
        });

        Ok(())
    }
}