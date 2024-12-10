use crate::{
    error::ErrorCode, lp_vault_signer_seeds, state::Permission, LpVault, JITO_FEE_ACCOUNT,
    JITO_POOL_TOKEN_MINT, JITO_RESERVE_STAKE_ACCOUNT, JITO_STAKE_POOL, JITO_WITHDRAW_AUTHORITY,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use spl_stake_pool::instruction::StakePoolInstruction;
use std::str::FromStr;

#[derive(Accounts)]
pub struct JitoStake<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
    )]
    pub permission: Box<Account<'info, Permission>>,

    #[account(
        has_one = vault,
    )]
    pub sol_lp_vault: Box<Account<'info, LpVault>>,

    #[account(mut)]
    pub vault: Box<Account<'info, TokenAccount>>,

    // We should init this on the client side first
    #[account(mut)]
    pub protocol_jito_vault: Box<Account<'info, TokenAccount>>,

    // Jito accounts required for CPI
    /// CHECK: Validated
    pub jito_stake_pool: AccountInfo<'info>,
    /// CHECK: Validated
    pub jito_withdraw_authority: AccountInfo<'info>,
    /// CHECK: Validated
    #[account(mut)]
    pub jito_stake_pool_reserve_account: AccountInfo<'info>,
    /// CHECK: Validated
    pub jito_fee_account: AccountInfo<'info>,

    #[account(mut)]
    pub jito_pool_token_mint: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> JitoStake<'info> {
    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        let jito_mint =
            Pubkey::from_str(JITO_POOL_TOKEN_MINT).map_err(|_| ErrorCode::InvalidPubkey)?;
        require_keys_eq!(
            ctx.accounts.jito_stake_pool.key(),
            Pubkey::from_str(JITO_STAKE_POOL).map_err(|_| ErrorCode::InvalidPubkey)?,
            ErrorCode::InvalidJitoStakePool
        );

        require_keys_eq!(
            ctx.accounts.jito_withdraw_authority.key(),
            Pubkey::from_str(JITO_WITHDRAW_AUTHORITY).map_err(|_| ErrorCode::InvalidPubkey)?,
            ErrorCode::InvalidJitoWithdrawAuthority,
        );

        require_keys_eq!(
            ctx.accounts.jito_fee_account.key(),
            Pubkey::from_str(JITO_FEE_ACCOUNT).map_err(|_| ErrorCode::InvalidPubkey)?,
            ErrorCode::InvalidJitoFeeAccount,
        );

        require_keys_eq!(
            ctx.accounts.jito_stake_pool_reserve_account.key(),
            Pubkey::from_str(JITO_RESERVE_STAKE_ACCOUNT).map_err(|_| ErrorCode::InvalidPubkey)?,
            ErrorCode::InvalidJitoReserveAccount,
        );

        require_keys_eq!(
            ctx.accounts.jito_pool_token_mint.key(),
            jito_mint,
            ErrorCode::InvalidJitoPoolTokenMint,
        );

        require_keys_eq!(
            ctx.accounts.protocol_jito_vault.owner,
            ctx.accounts.authority.key(),
            ErrorCode::IncorrectOwner,
        );

        require_keys_eq!(
            ctx.accounts.protocol_jito_vault.mint,
            jito_mint,
            ErrorCode::InvalidJitoPoolTokenMint
        );

        require!(
            ctx.accounts.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions,
        );

        Ok(())
    }

    pub fn stake_into_jito(&mut self, amount: u64) -> Result<()> {
        require_gt!(amount, 0, ErrorCode::ZeroAmount);

        let accounts = vec![
            AccountMeta::new(self.jito_stake_pool.key(), false),
            AccountMeta::new_readonly(self.jito_withdraw_authority.key(), false),
            AccountMeta::new(self.jito_stake_pool_reserve_account.key(), false),
            AccountMeta::new(self.vault.key(), false),
            AccountMeta::new(self.protocol_jito_vault.key(), false),
            AccountMeta::new(self.jito_fee_account.key(), false),
            AccountMeta::new(self.protocol_jito_vault.key(), false),
            AccountMeta::new(self.jito_pool_token_mint.key(), false),
            AccountMeta::new_readonly(self.system_program.key(), false),
            AccountMeta::new_readonly(self.token_program.key(), false),
        ];

        let instruction = anchor_lang::solana_program::instruction::Instruction {
            program_id: spl_stake_pool::ID,
            accounts,
            data: StakePoolInstruction::DepositSol(amount).try_to_vec()?,
        };

        let account_infos = [
            self.jito_stake_pool.to_account_info(),
            self.jito_withdraw_authority.to_account_info(),
            self.jito_stake_pool_reserve_account.to_account_info(),
            self.vault.to_account_info(),
            self.protocol_jito_vault.to_account_info(),
            self.jito_fee_account.to_account_info(),
            self.protocol_jito_vault.to_account_info(),
            self.jito_pool_token_mint.to_account_info(),
            self.system_program.to_account_info(),
            self.token_program.to_account_info(),
        ];

        anchor_lang::solana_program::program::invoke_signed(
            &instruction,
            &account_infos,
            &[lp_vault_signer_seeds!(self.sol_lp_vault)],
        )?;

        Ok(())
    }
}
