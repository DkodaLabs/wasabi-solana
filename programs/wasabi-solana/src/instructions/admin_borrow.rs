use {
    crate::{error::ErrorCode, lp_vault_signer_seeds, LpVault, Permission},
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

// NOTE: Might decide to go with a different implementation
// WORMHOLE: Bridgable token on both chains - so might have an ix where we pull out funds, wrap
// half of it in USDC and then put it into an AMM on both chains
// THEN: Wormhole permission messaging across chains (burn/mint)
// Removes admin controls - and having to call this ourselves
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
    #[account(
        mut,
        associated_token::mint = currency,
        associated_token::authority = lp_vault,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// TokenAccount that will receive borrowed tokens
    // NOTE: (Andrew) - Maybe this should be the holistic wallet and we infer the ATA
    #[account(mut)]
    pub destination: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = lp_vault.asset == currency.key(),
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,

    pub token_program: Interface<'info, TokenInterface>,
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

        require_gt!(
            ctx.accounts.lp_vault.max_borrow,
            ctx.accounts
                .lp_vault
                .total_borrowed
                .checked_add(args.amount)
                .expect("overflow"),
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

    pub fn admin_borrow(&mut self, args: &AdminBorrowArgs) -> Result<()> {
        // Transfer from vault to destination
        self.transfer_from_vault(args.amount)?;

        // increment total borrowed of the vault
        self.lp_vault.total_borrowed = self.lp_vault
            .total_borrowed
            .checked_add(args.amount)
            .expect("overflow");

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
