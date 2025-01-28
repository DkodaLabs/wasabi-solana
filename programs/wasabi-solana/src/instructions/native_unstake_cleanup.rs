use crate::{
    error::ErrorCode,
    events::NativeUnstaked,
    lp_vault_signer_seeds,
    state::{LpVault, NativeYield, StakeRequest},
    utils::get_function_hash,
};

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Revoke, TokenAccount, Mint, TokenInterface};

#[derive(Accounts)]
pub struct NativeUnstakeCleanup<'info> {
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
            b"native_yield",
            lp_vault.key().as_ref(),
            collateral.key().as_ref(),
        ],
        bump
    )]
    pub native_yield: Account<'info, NativeYield>,
    #[account(mut)]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        close = authority,
        seeds = [b"stake_req", native_yield.key().as_ref()],
        bump,
    )]
    pub stake_request: Account<'info, StakeRequest>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> NativeUnstakeCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "native_unstake_cleanup")
    }

    fn get_dst_delta(&self) -> Result<u64> {
        Ok(self
            .vault
            .amount
            .checked_sub(self.stake_request.stake_cache.dst_bal_before)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }

    fn get_src_delta(&self) -> Result<u64> {
        Ok(self
            .stake_request
            .stake_cache
            .src_bal_before
            .checked_sub(self.collateral_vault.amount)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }

    pub fn validate(&self) -> Result<()> {
        // Validate the same lp vault was used in setup and cleanup
        require_keys_eq!(
            self.stake_request.lp_vault_key,
            self.lp_vault.key(),
            ErrorCode::InvalidSwap,
        );

        require_gte!(
            self.get_dst_delta()?,
            self.stake_request.min_target_amount,
            ErrorCode::MinTokensNotMet,
        );

        require_gte!(
            self.stake_request.max_amount_in,
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

    pub fn native_unstake_cleanup(&mut self) -> Result<()> {
        self.validate()?;
        self.revoke_delegation()?;

        let amount_received = self.get_dst_delta()?;

        self.native_yield.total_borrowed_amount = self
            .native_yield
            .total_borrowed_amount
            .checked_sub(amount_received)
            .ok_or(ErrorCode::ArithmeticUnderflow)?;

        self.lp_vault.total_borrowed = self
            .lp_vault
            .total_borrowed
            .checked_sub(amount_received)
            .ok_or(ErrorCode::ArithmeticUnderflow)?;

        self.native_yield.last_updated = Clock::get()?.unix_timestamp;

        emit!(NativeUnstaked {
            native_yield: self.native_yield.key(),
            vault_address: self.collateral_vault.mint,
            collateral: self.collateral.key(),
            amount_unstaked: amount_received,
            collateral_sold: self.get_src_delta()?,
        });

        Ok(())
    }
}
