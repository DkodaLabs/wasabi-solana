use crate::{
    constants::{
        JITO_POOL_TOKEN_MINT, JITO_RESERVE_STAKE_ACCOUNT, JITO_STAKE_POOL, JITO_WITHDRAW_AUTHORITY,
    },
    error::ErrorCode,
    lp_vault_signer_seeds,
    state::Permission,
    LpVault, JITO_FEE_ACCOUNT,
};

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use spl_stake_pool::instruction::StakePoolInstruction;

use std::str::FromStr;

#[derive(Accounts)]
pub struct StakeFromVault<'info> {
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
        constraint = stake_vault.owner == lp_vault.key()
    )]
    pub stake_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    // Jito accounts required for CPI
    /// CHECK: Validated
    pub stake_pool: AccountInfo<'info>,
    /// CHECK: Validated
    pub stake_provider_withdraw_authority: AccountInfo<'info>,
    /// CHECK: Validated
    #[account(mut)]
    pub stake_pool_reserve_account: AccountInfo<'info>,
    /// CHECK: Validated
    pub stake_provider_fee_account: AccountInfo<'info>,

    #[account(mut)]
    pub stake_pool_token_mint: Box<InterfaceAccount<'info, Mint>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> StakeFromVault<'info> {
    pub fn validate(ctx: &Context<Self>, amount: u64) -> Result<()> {
        let jito_mint =
            Pubkey::from_str(JITO_POOL_TOKEN_MINT).map_err(|_| ErrorCode::InvalidPubkey)?;
        require_keys_eq!(
            ctx.accounts.stake_pool.key(),
            Pubkey::from_str(JITO_STAKE_POOL).map_err(|_| ErrorCode::InvalidPubkey)?,
            ErrorCode::InvalidJitoStakePool
        );

        require_keys_eq!(
            ctx.accounts.stake_provider_withdraw_authority.key(),
            Pubkey::from_str(JITO_WITHDRAW_AUTHORITY).map_err(|_| ErrorCode::InvalidPubkey)?,
            ErrorCode::InvalidJitoWithdrawAuthority,
        );

        require_keys_eq!(
            ctx.accounts.stake_provider_fee_account.key(),
            Pubkey::from_str(JITO_FEE_ACCOUNT).map_err(|_| ErrorCode::InvalidPubkey)?,
            ErrorCode::InvalidJitoFeeAccount,
        );

        require_keys_eq!(
            ctx.accounts.stake_pool_reserve_account.key(),
            Pubkey::from_str(JITO_RESERVE_STAKE_ACCOUNT).map_err(|_| ErrorCode::InvalidPubkey)?,
            ErrorCode::InvalidJitoReserveAccount,
        );

        require_keys_eq!(
            ctx.accounts.stake_pool_token_mint.key(),
            jito_mint,
            ErrorCode::InvalidJitoPoolTokenMint,
        );

        require_keys_eq!(
            ctx.accounts.stake_vault.mint,
            jito_mint,
            ErrorCode::InvalidJitoPoolTokenMint
        );

        require!(
            ctx.accounts.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions,
        );

        require_gt!(amount, 0, ErrorCode::ZeroAmount);

        require_gt!(
            ctx.accounts.lp_vault.max_borrow,
            ctx.accounts
                .lp_vault
                .total_borrowed
                .checked_add(amount)
                .ok_or(ErrorCode::ArithmeticOverflow)?,
            ErrorCode::MaxBorrowExceeded
        );

        Ok(())
    }

    pub fn stake_from_vault(&mut self, stake_amount: u64, min_target_amount: u64) -> Result<()> {
        let protocol_jito_balance_before = self.stake_vault.amount;

        let accounts = vec![
            AccountMeta::new(self.stake_pool.key(), false),
            AccountMeta::new_readonly(self.stake_provider_withdraw_authority.key(), false),
            AccountMeta::new(self.stake_pool_reserve_account.key(), false),
            AccountMeta::new(self.vault.key(), false),
            AccountMeta::new(self.stake_vault.key(), false),
            AccountMeta::new(self.stake_provider_fee_account.key(), false),
            AccountMeta::new(self.stake_vault.key(), false),
            AccountMeta::new(self.stake_pool_token_mint.key(), false),
            AccountMeta::new_readonly(self.system_program.key(), false),
            AccountMeta::new_readonly(self.token_program.key(), false),
        ];

        let instruction = anchor_lang::solana_program::instruction::Instruction {
            program_id: spl_stake_pool::ID,
            accounts,
            data: StakePoolInstruction::DepositSol(stake_amount).try_to_vec()?,
        };

        let account_infos = [
            self.stake_pool.to_account_info(),
            self.stake_provider_withdraw_authority.to_account_info(),
            self.stake_pool_reserve_account.to_account_info(),
            self.vault.to_account_info(),
            self.stake_vault.to_account_info(),
            self.stake_provider_fee_account.to_account_info(),
            self.stake_vault.to_account_info(),
            self.stake_pool_token_mint.to_account_info(),
            self.system_program.to_account_info(),
            self.token_program.to_account_info(),
        ];

        anchor_lang::solana_program::program::invoke_signed(
            &instruction,
            &account_infos,
            &[lp_vault_signer_seeds!(self.lp_vault)],
        )?;

        self.stake_vault.reload()?;

        require_gte!(
            self.stake_vault
                .amount
                .checked_sub(protocol_jito_balance_before)
                .ok_or(ErrorCode::ArithmeticUnderflow)?,
            min_target_amount,
            ErrorCode::MinTokensNotMet
        );

        self.lp_vault.total_borrowed = self
            .lp_vault
            .total_borrowed
            .checked_add(stake_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        Ok(())
    }
}
