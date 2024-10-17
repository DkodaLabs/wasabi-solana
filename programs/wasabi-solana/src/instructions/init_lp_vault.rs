use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{error::ErrorCode, events::NewVault, LpVault, Permission};

#[derive(Accounts)]
pub struct InitLpVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The key that has permission to init the vault
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
    )]
    pub permission: Account<'info, Permission>,

    #[account(
        init,
        payer = payer,
        seeds = [b"lp_vault", asset_mint.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<LpVault>(),
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,

    pub asset_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = asset_mint,
        associated_token::authority = lp_vault,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = payer,
        seeds = [lp_vault.key().as_ref(), asset_mint.key().as_ref()],
        bump,
        mint::authority = lp_vault,
        mint::decimals = asset_mint.decimals,
    )]
    pub shares_mint: Box<InterfaceAccount<'info, Mint>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
impl<'info> InitLpVault<'info> {
    pub fn validate(ctx: &Context<InitLpVault>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_init_vault(),
            ErrorCode::InvalidPermissions
        );
        Ok(())
    }

    pub fn init_lp_vault(&mut self, bumps: &InitLpVaultBumps) -> Result<()> {
        self.lp_vault.set_inner(LpVault {
            bump: bumps.lp_vault,
            asset: self.asset_mint.key(),
            vault: self.vault.key(),
            shares_mint: self.shares_mint.key(),
            total_assets: 0,
            total_borrowed: 0,
            max_borrow: 0,
        });

        emit!(NewVault::new(&self.lp_vault));

        Ok(())
    }
}

//pub fn handler(ctx: Context<InitLpVault>) -> Result<()> {
//    let lp_vault: &mut Account<LpVault> = &mut ctx.accounts.lp_vault;
//
//    lp_vault.bump = ctx.bumps.lp_vault;
//    lp_vault.asset = ctx.accounts.asset_mint.key();
//    lp_vault.vault = ctx.accounts.vault.key();
//    lp_vault.shares_mint = ctx.accounts.shares_mint.key();
//    lp_vault.total_assets = 0;
//    lp_vault.total_borrowed = 0;
//    // TODO should this be able to be set at time of initialization?
//    lp_vault.max_borrow = 0;
//
//    emit!(NewVault::new(lp_vault));
//
//    Ok(())
//}

