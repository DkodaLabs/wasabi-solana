use {
    crate::{error::ErrorCode, lp_vault_signer_seeds, LpVault, Permission},
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

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

    /// Source of the borrowed tokens
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = currency,
        associated_token::authority = authority,
        associated_token::token_program = token_program,
    )]
    pub destination: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        has_one = vault,
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> AdminBorrow<'info> {
    pub fn validate(ctx: &Context<AdminBorrow>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.permission.can_borrow_from_vault(),
            ErrorCode::InvalidPermissions
        );

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

    fn transfer_from_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.currency.to_account_info(),
            to: self.destination.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };
        token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
    }

    pub fn admin_borrow(&mut self, amount: u64) -> Result<()> {
        // Transfer from vault to destination
        self.transfer_from_vault(amount)?;

        // increment total borrowed of the vault
        self.lp_vault.total_borrowed = self
            .lp_vault
            .total_borrowed
            .checked_add(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        Ok(())
    }
}
