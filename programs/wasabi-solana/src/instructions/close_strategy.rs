use {
    crate::{error::ErrorCode, lp_vault_signer_seeds, state::Strategy, LpVault, Permission},
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{
        close_account, CloseAccount, Mint, TokenAccount, TokenInterface,
    },
};

#[derive(Accounts)]
pub struct CloseStrategy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

    pub lp_vault: Account<'info, LpVault>,

    pub collateral: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        close = authority,
        has_one = collateral,
        has_one = lp_vault,
        has_one = collateral_vault,
        seeds = [
            b"strategy",
            lp_vault.key().as_ref(),
            collateral.key().as_ref()
        ],
        bump
    )]
    pub strategy: Account<'info, Strategy>,
    #[account(mut, constraint = collateral_vault.owner == lp_vault.key())]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    // The token program that controls the collateral token
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> CloseStrategy<'info> {
    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions
        );

        require_eq!(
            ctx.accounts.collateral_vault.amount,
            0,
            ErrorCode::VaultNotEmpty
        );

        Ok(())
    }

    pub fn close_strategy(&mut self) -> Result<()> {
        let cpi_accounts = CloseAccount {
            account: self.collateral_vault.to_account_info(),
            destination: self.authority.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };

        close_account(cpi_ctx)?;

        Ok(())
    }
}
