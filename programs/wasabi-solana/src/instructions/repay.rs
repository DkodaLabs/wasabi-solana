use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{error::ErrorCode, LpVault};

#[derive(Accounts)]
pub struct Repay<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    /// Source of the tokens being repaid
    pub source: Account<'info, TokenAccount>,

    #[account(mut)]
    /// TokenAccount of the LP Vault that will receive borrowed tokens
    pub vault: Account<'info, TokenAccount>,

    #[account(
    mut,
    has_one = vault,
  )]
    pub lp_vault: Account<'info, LpVault>,

    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RepayArgs {
    amount: u64,
}

impl<'info> Repay<'info> {
    pub fn validate(ctx: &Context<Repay>, args: &RepayArgs) -> Result<()> {
        // Prevent over repaying to ensure vault accounting works
        require!(
            args.amount <= ctx.accounts.lp_vault.total_borrowed,
            ErrorCode::MaxRepayExceeded
        );
        Ok(())
    }

    pub fn transfer_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.source.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.payer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)
    }
}

pub fn handler(ctx: Context<Repay>, args: RepayArgs) -> Result<()> {
    ctx.accounts.transfer_to_vault(args.amount)?;

    let lp_vault = &mut ctx.accounts.lp_vault;
    lp_vault.total_borrowed = lp_vault
        .total_borrowed
        .checked_sub(args.amount)
        .expect("overflow");
    Ok(())
}
