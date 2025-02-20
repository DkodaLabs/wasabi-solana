use {
    crate::{error::ErrorCode, LpVault, Permission, Strategy},
    anchor_lang::prelude::*,
    anchor_spl::{
        token_interface::{Mint, TokenAccount, TokenInterface},
        associated_token::AssociatedToken,
    },
};

#[derive(Accounts)]
pub struct InitStrategy<'info> {
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
            b"strategy",
            lp_vault.key().as_ref(),
            collateral.key().as_ref(),
        ],
        bump,
        space = 8 + std::mem::size_of::<Strategy>(),
    )]
    pub strategy: Account<'info, Strategy>,

    /// The lp vault's collateral token account
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = collateral,
        associated_token::authority = lp_vault,
        associated_token::token_program = token_program,
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitStrategy<'info> {
    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions
        );

        Ok(())
    }

    pub fn init_strategy(&mut self, bumps: &InitStrategyBumps) -> Result<()> {
        self.strategy.set_inner(Strategy {
            bump: bumps.strategy,
            lp_vault: self.lp_vault.key(),
            currency: self.currency.key(),
            collateral: self.collateral.key(),
            collateral_vault: self.collateral_vault.key(),
            collateral_amount: 0,
            total_borrowed_amount: 0,
            last_updated: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
