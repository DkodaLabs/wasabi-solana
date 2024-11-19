use {
    crate::{error::ErrorCode, LpVault},
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
pub struct Repay<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Mint of the tokens to be transfered - required for `TransferChecked`
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = payer,
        associated_token::token_program = token_program
    )]
    pub source: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        has_one = vault,
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,

    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> Repay<'info> {
    pub fn validate(ctx: &Context<Repay>, amount: u64) -> Result<()> {
        // Prevent over repaying to ensure vault accounting works
        require_gte!(
            ctx.accounts.lp_vault.total_borrowed,
            amount,
            ErrorCode::MaxRepayExceeded
        );
        Ok(())
    }

    fn transfer_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.source.to_account_info(),
            mint: self.mint.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.payer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, self.mint.decimals)
    }

    pub fn repay(&mut self, amount: u64) -> Result<()> {
        self.transfer_to_vault(amount)?;
        self.lp_vault.total_borrowed = self
            .lp_vault
            .total_borrowed
            .checked_sub(amount)
            .ok_or(ErrorCode::ArithmeticUnderflow)?;

        Ok(())
    }
}
