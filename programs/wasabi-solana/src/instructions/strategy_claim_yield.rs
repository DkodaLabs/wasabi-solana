use {
    crate::{
        error::ErrorCode,
        events::StrategyClaim,
        state::{LpVault, Permission, Strategy},
        utils::{get_function_hash, get_shares_mint_address, validate_difference},
    },
    anchor_lang::prelude::*,
    anchor_spl::token_interface::Mint,
};

#[derive(Accounts)]
pub struct StrategyClaimYield<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

    #[account(mut)]
    pub lp_vault: Account<'info, LpVault>,

    pub collateral: Box<InterfaceAccount<'info, Mint>>,

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
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "strategy_claim_yield")
    }

    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions
        );

        Ok(())
    }

    pub fn strategy_claim_yield(&mut self, new_quote: u64) -> Result<()> {
        validate_difference(self.strategy.total_borrowed_amount, new_quote, 1)?;

        let shares_mint = get_shares_mint_address(&self.lp_vault.key(), &self.strategy.currency);

        let interest_earned = new_quote.abs_diff(self.strategy.total_borrowed_amount);
        let mut interest_earned_i64: i64 = interest_earned.try_into()?;

        if new_quote <= self.strategy.total_borrowed_amount {
            self.strategy.total_borrowed_amount = self
                .strategy
                .total_borrowed_amount
                .checked_sub(interest_earned)
                .ok_or(ErrorCode::ArithmeticUnderflow)?;

            self.lp_vault.total_assets = self
                .lp_vault
                .total_assets
                .checked_sub(interest_earned)
                .ok_or(ErrorCode::ArithmeticUnderflow)?;

            self.lp_vault.total_borrowed = self
                .lp_vault
                .total_borrowed
                .checked_sub(interest_earned)
                .ok_or(ErrorCode::ArithmeticUnderflow)?;
            interest_earned_i64 *= -1i64;
        } else {
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
        }

        emit!(StrategyClaim {
            strategy: self.strategy.key(),
            vault_address: shares_mint,
            collateral: self.collateral.key(),
            amount: interest_earned_i64,
        });

        Ok(())
    }
}
