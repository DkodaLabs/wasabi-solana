use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{error::ErrorCode, BasePool, Permission};

#[derive(Accounts)]
pub struct InitShortPool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The key that has permission to init the short_pool
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
    )]
    pub permission: Account<'info, Permission>,

    // TODO: Provide these as arguments
    // NOTE: This may be unnecessary as an account
    pub asset_mint: InterfaceAccount<'info, Mint>,

    // NOTE: This may be unnecessary as an account
    pub currency_mint: InterfaceAccount<'info, Mint>,

    #[account(
      init,
      payer = payer,
      seeds = [b"short_pool", asset_mint.key().as_ref(), currency_mint.key().as_ref()],
      bump,
      space = 8 + std::mem::size_of::<BasePool>(),
    )]
    pub short_pool: Account<'info, BasePool>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = asset_mint,
        associated_token::authority = short_pool,
        associated_token::token_program = token_program,
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = currency_mint,
        associated_token::authority = short_pool,
        associated_token::token_program = token_program,
    )]
    pub currency_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitShortPool<'info> {
    pub fn validate(ctx: &Context<InitShortPool>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_init_vault(),
            ErrorCode::InvalidPermissions
        );
        Ok(())
    }

    pub fn init_short_pool(&mut self, bumps: &InitShortPoolBumps) -> Result<()> {
        self.short_pool.set_inner(BasePool {
            is_long_pool: false,
            collateral: self.asset_mint.key(),
            collateral_vault: self.collateral_vault.key(),
            currency: self.currency_mint.key(),
            currency_vault: self.currency_vault.key(),
            bump: bumps.short_pool,
        });

        Ok(())
    }
}

//pub fn handler(ctx: Context<InitShortPool>) -> Result<()> {
//    let short_pool = &mut ctx.accounts.short_pool;
//    short_pool.is_long_pool = false;
//    short_pool.collateral = ctx.accounts.asset_mint.key();
//    short_pool.collateral_vault = ctx.accounts.collateral_vault.key();
//    short_pool.currency = ctx.accounts.currency_mint.key();
//    short_pool.currency_vault = ctx.accounts.currency_vault.key();
//    short_pool.bump = ctx.bumps.short_pool;
//
//    Ok(())
//}
