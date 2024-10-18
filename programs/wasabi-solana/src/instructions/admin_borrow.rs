use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{error::ErrorCode, lp_vault, lp_vault_signer_seeds, LpVault, Permission};

#[derive(Accounts)]
pub struct AdminBorrow<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The key that has permission to init the vault
    pub authority: Signer<'info>,

    #[account(
    has_one = authority,
  )]
    pub permission: Account<'info, Permission>,

    #[account(mut)]
    /// Source of the borrowed tokens
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    /// TokenAccount that will receive borrowed tokens
    pub destination: Account<'info, TokenAccount>,

    #[account(
    mut,
    has_one = vault,
  )]
    pub lp_vault: Account<'info, LpVault>,

    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdminBorrowArgs {
    amount: u64,
}

impl<'info> AdminBorrow<'info> {
    pub fn validate(ctx: &Context<AdminBorrow>, args: &AdminBorrowArgs) -> Result<()> {
        require!(
            ctx.accounts.permission.can_borrow_from_vault(),
            ErrorCode::InvalidPermissions
        );

        if ctx
            .accounts
            .lp_vault
            .total_borrowed
            .checked_add(args.amount)
            .expect("overflow")
            > ctx.accounts.lp_vault.max_borrow
        {
            return Err(ErrorCode::MaxBorrowExceeded.into());
        }

        Ok(())
    }

    pub fn transfer_from_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.destination.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };
        token::transfer(cpi_ctx, amount)
    }
}

pub fn handler(ctx: Context<AdminBorrow>, args: AdminBorrowArgs) -> Result<()> {
    // Transfer from vault to destination
    ctx.accounts.transfer_from_vault(args.amount)?;

    // increment total borrowed of the vault
    let lp_vault: &mut Account<'_, LpVault> = &mut ctx.accounts.lp_vault;
    lp_vault.total_borrowed = lp_vault
        .total_borrowed
        .checked_add(args.amount)
        .expect("overflow");
    Ok(())
}
