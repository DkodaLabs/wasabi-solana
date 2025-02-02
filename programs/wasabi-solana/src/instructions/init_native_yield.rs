use {
    crate::{error::ErrorCode, LpVault, NativeYield, Permission},
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{Mint, TokenAccount},
};

#[derive(Accounts)]
pub struct InitNativeYield<'info> {
    /// The account that has permission to borrow from the vaults
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

    /// The lp vault being borrowed from
    #[account(has_one = vault)]
    pub lp_vault: Account<'info, LpVault>,
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint of the asset held by the lp vault
    pub currency: Box<InterfaceAccount<'info, Mint>>,
    /// The mint of the token received for staking the lp vault asset
    pub collateral: Box<InterfaceAccount<'info, Mint>>,

    /// The 'strategy'
    #[account(
        init,
        payer = authority,
        seeds = [
            b"native_yield", 
            lp_vault.key().as_ref(),
            collateral.key().as_ref(),
        ],
        bump,
        space = 8 + std::mem::size_of::<NativeYield>(),
    )]
    pub native_yield: Account<'info, NativeYield>,

    /// The lp vault's collateral token account
    #[account(constraint = collateral_vault.owner == lp_vault.key())]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitNativeYield<'info> {
    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions
        );

        Ok(())
    }

    pub fn init_native_yield(&mut self, bumps: &InitNativeYieldBumps) -> Result<()> {
        self.native_yield.set_inner(NativeYield {
            bump: bumps.native_yield,
            lp_vault: self.lp_vault.key(),
            currency: self.currency.key(),
            collateral: self.collateral.key(),
            collateral_vault: self.collateral_vault.key(),
            total_borrowed_amount: 0,
            last_updated: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
