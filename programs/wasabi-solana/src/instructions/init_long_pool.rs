use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{error::ErrorCode, BasePool, Permission};

#[derive(Accounts)]
pub struct InitLongPool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The key that has permission to init the long_pool
    pub authority: Signer<'info>,

    #[account(
    has_one = authority,
  )]
    pub permission: Account<'info, Permission>,

    // NOTE: This may be unnecessary as an account
    pub asset_mint: Account<'info, Mint>,

    #[account(
    init,
    payer = payer,
    seeds = [b"long_pool", asset_mint.key().as_ref()],
    bump,
    space = 8 + std::mem::size_of::<BasePool>(),
  )]
    pub long_pool: Account<'info, BasePool>,

    #[account(
    init,
    payer = payer,
    associated_token::mint = asset_mint,
    associated_token::authority = long_pool,
  )]
    pub collateral_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitLongPool<'info> {
    pub fn validate(ctx: &Context<InitLongPool>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_init_vault(),
            ErrorCode::InvalidPermissions
        );
        Ok(())
    }
}

pub fn handler(ctx: Context<InitLongPool>) -> Result<()> {
    let long_pool = &mut ctx.accounts.long_pool;
    long_pool.is_long_pool = true;
    long_pool.collateral = ctx.accounts.asset_mint.key();
    long_pool.collateral_vault = ctx.accounts.collateral_vault.key();

    Ok(())
}
