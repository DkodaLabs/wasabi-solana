use {
    crate::{error::ErrorCode, NativeYield,  StakeRequest, lp_vault_signer_seeds, LpVault, utils::get_function_hash, events::NativeStaked},
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{Revoke, TokenAccount, TokenInterface, revoke},
};

#[derive(Accounts)]
pub struct NativeStakeCleanup<'info> {
    pub authority: Signer<'info>,

    #[account(mut, has_one = vault)]
    pub lp_vault: Account<'info, LpVault>,
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        close = authority,
        seeds = [b"stake_req", native_yield.key().as_ref()],
        bump,
    )]
    pub stake_request: Account<'info, StakeRequest>,

    #[account(mut)]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

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
        bump,
    )]
    pub native_yield: Account<'info, NativeYield>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> NativeStakeCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "native_stake_cleanup")
    }

    pub fn validate(&self) -> Result<()> {
        require_keys_eq!(self.lp_vault.key(), self.stake_request.lp_vault_key);
        require_keys_eq!(self.native_yield.key(), self.stake_request.native_yield);
        require_gte!(
            self.get_dst_delta()?,
            self.stake_request.min_target_amount
        );
        require_gte!(
            self.stake_request.max_amount_in,
            self.get_src_delta()?,
            ErrorCode::SwapAmountExceeded
        );

        Ok(())
    }

    fn get_dst_delta(&self) -> Result<u64> {
        Ok(self
            .collateral_vault
            .amount
            .checked_sub(self.stake_request.stake_cache.dst_bal_before)
            .ok_or(ErrorCode::ArithmeticOverflow)?)
    }

    #[inline]
    fn get_src_delta(&self) -> Result<u64> {
        Ok(self
            .vault
            .amount
            .checked_sub(self.stake_request.stake_cache.src_bal_before)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }

    fn revoke_delegation(&self) -> Result<()> {
        let cpi_accounts = Revoke {
            source: self.vault.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };

        revoke(cpi_ctx)
    }

    pub fn native_stake_cleanup(&mut self) -> Result<()> {
        self.validate()?;
        self.revoke_delegation()?;

        let amount_sent = self.get_src_delta()?;

        self.native_yield.total_borrowed_amount = self
            .native_yield
            .total_borrowed_amount
            .checked_add(amount_sent)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.lp_vault.total_borrowed = self
            .lp_vault.total_borrowed
            .checked_add(amount_sent)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        emit!(NativeStaked {
            vault_address: self.lp_vault.key(),
            amount_staked: amount_sent,
            collateral_received: self.get_dst_delta()?,
        });

        Ok(())
    }
}
