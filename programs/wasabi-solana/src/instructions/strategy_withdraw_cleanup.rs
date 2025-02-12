use {
    crate::{
        error::ErrorCode,
        events::StrategyWithdraw,
        lp_vault_signer_seeds,
        state::{LpVault, Strategy, StrategyRequest},
        utils::{get_function_hash, get_shares_mint_address},
    },
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{self, Mint, Revoke, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
pub struct StrategyWithdrawCleanup<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, has_one = vault)]
    pub lp_vault: Box<Account<'info, LpVault>>,
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        has_one = lp_vault,
        has_one = collateral_vault,
        has_one = collateral,
        seeds = [
            b"strategy",
            lp_vault.key().as_ref(),
            collateral.key().as_ref(),
        ],
        bump
    )]
    pub strategy: Account<'info, Strategy>,

    #[account(
        mut,
        constraint = collateral_vault.owner == lp_vault.key(),
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        close = authority,
        seeds = [b"strategy_request", strategy.key().as_ref()],
        bump,
    )]
    pub strategy_request: Account<'info, StrategyRequest>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> StrategyWithdrawCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "strategy_withdraw_cleanup")
    }

    fn get_dst_delta(&self) -> Result<u64> {
        Ok(self
            .vault
            .amount
            .checked_sub(self.strategy_request.strategy_cache.dst_bal_before)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }

    fn get_src_delta(&self) -> Result<u64> {
        Ok(self
            .strategy_request
            .strategy_cache
            .src_bal_before
            .checked_sub(self.collateral_vault.amount)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }

    pub fn validate(&self) -> Result<()> {
        // Validate the same lp vault was used in setup and cleanup
        require_keys_eq!(
            self.strategy_request.lp_vault_key,
            self.lp_vault.key(),
            ErrorCode::InvalidSwap,
        );

        require_gte!(
            self.get_dst_delta()?,
            self.strategy_request.min_target_amount,
            ErrorCode::MinTokensNotMet,
        );

        require_gte!(
            self.strategy_request.max_amount_in,
            self.get_src_delta()?,
            ErrorCode::SwapAmountExceeded,
        );

        Ok(())
    }

    fn revoke_delegation(&self) -> Result<()> {
        let cpi_accounts = Revoke {
            source: self.collateral_vault.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };

        token_interface::revoke(cpi_ctx)
    }

    pub fn strategy_withdraw_cleanup(&mut self) -> Result<()> {
        self.validate()?;
        self.revoke_delegation()?;

        let principal_received = self.get_dst_delta()?;
        let collateral_spent = self.get_src_delta()?;
        let principal_before = self.strategy_request.strategy_cache.dst_bal_before;
        let collateral_before = self.strategy_request.strategy_cache.src_bal_before;

        if collateral_spent != collateral_before {
            let new_quote = principal_before
                .checked_mul(
                    collateral_before
                        .checked_sub(collateral_spent)
                        .ok_or(ErrorCode::ArithmeticUnderflow)?,
                )
                .ok_or(ErrorCode::ArithmeticOverflow)?
                .checked_div(
                    collateral_before
                        .checked_add(principal_received)
                        .ok_or(ErrorCode::ArithmeticOverflow)?,
                )
                .ok_or(ErrorCode::ArithmeticOverflow)?;

            self.strategy.claim_yield(&mut self.lp_vault, new_quote)?;
        } else {
            self.strategy
                .claim_yield(&mut self.lp_vault, principal_received)?;
        }

        // Decrement collateral held by strategy
        self.strategy.collateral_amount = self
            .strategy
            .collateral_amount
            .checked_sub(collateral_spent)
            .ok_or(ErrorCode::ArithmeticUnderflow)?;

        self.strategy.total_borrowed_amount = self
            .strategy
            .total_borrowed_amount
            .checked_sub(principal_received)
            .ok_or(ErrorCode::ArithmeticUnderflow)?;

        self.lp_vault.total_borrowed = self
            .lp_vault
            .total_borrowed
            .checked_sub(principal_received)
            .ok_or(ErrorCode::ArithmeticUnderflow)?;

        self.strategy.last_updated = Clock::get()?.unix_timestamp;

        emit!(StrategyWithdraw {
            strategy: self.strategy.key(),
            vault_address: get_shares_mint_address(&self.lp_vault.key(), &self.strategy.currency),
            collateral: self.collateral.key(),
            amount_withdraw: principal_received,
            collateral_sold: collateral_spent,
        });

        Ok(())
    }
}