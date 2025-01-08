use {
    crate::{lp_vault_signer_seeds, LpVault, NativeYield},
    anchor::prelude::*,
    anchor_spl::token_interface::{close_account, CloseAccount, TokenAccount, TokenInterface},
};

pub struct CloseNativeYield<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

    pub lp_vault: Account<'info, LpVault>,

    #[account(
        mut,
        close = authority,
        has_one = collateral,
        has_one = lp_vault,
        has_one = collateral_vault,
        seeds = [
            b"native_yield",
            lp_vault.key().as_ref(),
            collateral.key().as_ref()
        ],
        bump
    )]
    pub native_yield: Account<'info, NativeYield>,
    #[account(
        mut,
        associated_token::mint = collateral.key(),
        associated_token::authority = lp_vault.key(),
        associated_token::token_program = token_program.key(),
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral: Box<InterfaceAccount<'info, Mint>>,

    // The token program that controls the collateral token
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> CloseNativeYield<'info> {
    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        require!(
            ctx.account.permission.can_borrow_from_vaults(),
            true,
            ErrorCode::InvalidPermissions
        );

        Ok(())
    }

    pub fn close_native_yield(&mut self) -> Result<()> {
        let cpi_accounts = CloseAccount {
            account: self.collateral_vault.to_account_info(),
            destination: self.authority.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_acocunts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };

        token_interface::close_account(cpi_ctx)?;

        Ok(())
    }
}
