use {
    crate::{
        error::ErrorCode,
        events::StrategyWithdraw,
        lp_vault_signer_seeds,
        state::{LpVault, Permission, Strategy, StrategyRequest},
        utils::{get_function_hash, get_shares_mint_address},
        StrategyClaimYield,
    },
    anchor_lang::{prelude::*, solana_program::instruction::Instruction},
    anchor_spl::token_interface::{self, Mint, Revoke, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
pub struct StrategyWithdrawCleanup<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

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

    ///CHECK: Applied by constraint
    #[account(address = crate::ID)]
    pub wasabi_program: AccountInfo<'info>,
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

        let new_quote = if collateral_spent != collateral_before {
            principal_before
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
                .ok_or(ErrorCode::ArithmeticOverflow)?
        } else {
            principal_received
        };

        // Approach (1)
        // -- Should emit event, event will probably be in "program data" same as
        // last approach
        //let mut strategy_yield_accounts = StrategyClaimYield {
        //    authority: self.authority.clone(),
        //    permission: self.permission.clone(),
        //    lp_vault: *self.lp_vault.clone(),
        //    collateral: self.collateral.clone(),
        //    strategy: self.strategy.clone(),
        //};

        //let claim_yield_ctx = Context::<StrategyClaimYield>::new(
        //    &crate::ID,
        //    &mut strategy_yield_accounts,
        //    &[],
        //    StrategyClaimYieldBumps {
        //        strategy: bumps.strategy,
        //    },
        //);

        //claim_yield_ctx.accounts.strategy_claim_yield(new_quote)?;

        let sighash = StrategyClaimYield::get_hash();
        let mut ix_data = Vec::with_capacity(16);

        ix_data.extend_from_slice(&sighash);
        ix_data.extend_from_slice(&new_quote.to_le_bytes());
        let ix = Instruction {
            program_id: self.wasabi_program.key(),
            accounts: vec![
                AccountMeta::new(self.authority.key(), true),
                AccountMeta::new_readonly(self.permission.key(), false),
                AccountMeta::new(self.lp_vault.key(), false),
                AccountMeta::new_readonly(self.collateral.key(), false),
                AccountMeta::new(self.strategy.key(), false),
            ],
            data: ix_data,
        };

        // Re-invoke the program to emit the `StrategyClaim` event
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                self.authority.to_account_info(),
                self.permission.to_account_info(),
                self.lp_vault.to_account_info(),
                self.collateral.to_account_info(),
                self.strategy.to_account_info(),
            ],
        )?;

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