use {
    crate::{
        error::ErrorCode, events::StrategyDeposit, lp_vault_signer_seeds, utils::get_function_hash,
        utils::get_shares_mint_address, LpVault, Strategy, StrategyRequest,
    },
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{revoke, Mint, Revoke, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
pub struct StrategyDepositCleanup<'info> {
    /// The account that has permission to borrow from the vaults
    pub authority: Signer<'info>,

    /// The lp vault being borrowed from
    #[account(mut, has_one = vault)]
    pub lp_vault: Account<'info, LpVault>,

    /// The token account for the asset which the lp vault holds
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint of the token that will be received for staking the vault asset
    pub collateral: Box<InterfaceAccount<'info, Mint>>,

    /// Temporary 'cache' account to store the state of the stake request between instructions
    #[account(
        mut,
        close = authority,
        seeds = [b"strategy_request", strategy.key().as_ref()],
        bump,
    )]
    pub strategy_request: Account<'info, StrategyRequest>,

    /// The account that holds the strategy's state
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
        bump,
    )]
    pub strategy: Account<'info, Strategy>,

    /// The lp vault's collateral token account
    #[account(
        mut,
        constraint = collateral_vault.owner == lp_vault.key(),
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> StrategyDepositCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "strategy_deposit_cleanup")
    }

    pub fn validate(&self) -> Result<()> {
        require_keys_eq!(self.lp_vault.key(), self.strategy_request.lp_vault_key);
        require_keys_eq!(self.strategy.key(), self.strategy_request.strategy);
        require_gte!(
            self.get_dst_delta()?,
            self.strategy_request.min_target_amount
        );
        require_gte!(
            self.strategy_request.max_amount_in,
            self.get_src_delta()?,
            ErrorCode::SwapAmountExceeded
        );

        Ok(())
    }

    // The difference between the lp vault's collateral token account before and after staking
    fn get_dst_delta(&self) -> Result<u64> {
        Ok(self
            .collateral_vault
            .amount
            .checked_sub(self.strategy_request.strategy_cache.dst_bal_before)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }

    // The difference between the lp vault's asset token account before and after staking
    #[inline]
    fn get_src_delta(&self) -> Result<u64> {
        Ok(self
            .strategy_request
            .strategy_cache
            .src_bal_before
            .checked_sub(self.vault.amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?)
    }

    // Revoke the authority's permission to stake on behalf of the lp vault
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

    pub fn strategy_deposit_cleanup(&mut self) -> Result<()> {
        self.validate()?;
        self.revoke_delegation()?;

        let collateral_received = self.get_dst_delta()?;
        let amount_deposited = self.get_src_delta()?;

        // Increase the total borrowed amount in the lp vault and strategy by
        // the amount that was staked
        self.strategy.total_borrowed_amount = self
            .strategy
            .total_borrowed_amount
            .checked_add(amount_deposited)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        // Increment collateral held by the strategy
        self.strategy.collateral_amount = self
            .strategy
            .collateral_amount
            .checked_add(collateral_received)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.lp_vault.total_borrowed = self
            .lp_vault
            .total_borrowed
            .checked_add(amount_deposited)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.strategy.last_updated = Clock::get()?.unix_timestamp;

        emit!(StrategyDeposit {
            strategy: self.strategy.key(),
            vault_address: get_shares_mint_address(&self.lp_vault.key(), &self.strategy.currency),
            collateral: self.collateral.key(),
            amount_deposited,
            collateral_received,
        });

        Ok(())
    }
}
