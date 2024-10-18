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

    #[account(mut)]
    /// Source of the borrowed tokens
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    /// TokenAccount that will receive borrowed tokens
    pub destination: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdminBorrowArgs {
    amount: u64,
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
                .ok_or(ErrorCode::Overflow)?
        );

        Ok(())
    }

    // NOTE: Pattern appears a lot - abstract
    fn transfer_from_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.mint.to_account_info(),
            to: self.destination.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };
        token_interface::transfer_checked(cpi_ctx, amount, self.mint.decimals)
    }

    pub fn admin_borrow(&mut self, amount: u64) -> Result<()> {
        // Transfer from vault to destination
        self.transfer_from_vault(amount)?;

        // increment total borrowed of the vault
        // NOTE: Does this increment? It seems to just replace `total_borrowed` with `args.amount`
        self.lp_vault.total_borrowed = amount;

        Ok(())
    }
}

//pub fn handler(ctx: Context<AdminBorrow>, args: AdminBorrowArgs) -> Result<()> {
//    // Transfer from vault to destination
//    ctx.accounts.transfer_from_vault(args.amount)?;
//
//    // increment total borrowed of the vault
//    let lp_vault = &mut ctx.accounts.lp_vault;
//    lp_vault.total_borrowed = args.amount;
//
//    Ok(())
//}
