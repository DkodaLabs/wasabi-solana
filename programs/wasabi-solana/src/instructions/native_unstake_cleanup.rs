use crate::{
    error::ErrorCode,
    lp_vault_signer_seeds,
    state::{LpVault, Permission, StakeRequest},
    utils::get_function_hash,
};

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Revoke, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct NativeUnstakeCleanup<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Box<Account<'info, Permission>>,

    #[account(mut, has_one = vault)]
    pub lp_vault: Box<Account<'info, LpVault>>,
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        has_one = lp_vault.key(),
        has_one = collateral_vault.key(),
        has_one = collateral.key(),
        seeds = [
            b"native_yield",
            lp_vault.key().as_ref(),
            collateral.key().as_ref(),
        ],
        bump
    )]
    pub native_yield: Account<'info, NativeYield>,
    #[account(
        mut,
        constraint = stake_vault.owner == lp_vault.key()
    )]
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
            .checked_sub(self.swap_request.swap_cache.dst_bal_before)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }

    fn get_src_delta(&self) -> Result<u64> {
        Ok(self
            .swap_request
            .swap_cache
            .src_bal_before
            .checked_sub(self.stake_vault.amount)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }

    pub fn validate(&self) -> Result<()> {
        // Validate the same lp vault was used in setup and cleanup
        require_keys_eq!(
            self.swap_request.lp_vault_key,
            self.lp_vault.key(),
            ErrorCode::InvalidSwap,
        );

        require_gte!(
            self.get_dst_delta()?,
            self.swap_request.min_target_amount,
            ErrorCode::MinTokensNotMet,
        );

        require_gte!(
            self.swap_request.max_amount_in,
            self.get_src_delta()?,
            ErrorCode::SwapAmountExceeded,
        );

        require!(
            self.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions
        );

        Ok(())
    }

    fn revoke_delegation(&self) -> Result<()> {
        let cpi_accounts = Revoke {
            source: self.stake_vault.to_account_info(),
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

    pub fn unstake_cleanup(&mut self) -> Result<()> {
        self.validate()?;
        self.revoke_delegation()?;
        Ok(())
    }
}
