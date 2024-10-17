use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{error::ErrorCode, BasePool, Permission};

#[derive(Accounts)]
pub struct InitLongPool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The key that has permission to init the long_pool
    // NOTE: Why are both signers
    pub authority: Signer<'info>,

    #[account(
      has_one = authority,
    )]
    pub permission: Account<'info, Permission>,

    // NOTE: (Andrew) These don't really need to be passed in as accounts and increases the call
    // data size, they should really be provided as arguments, but should be validated.
    // TODO: Provide these as arguments
    // NOTE: This may be unnecessary as an account
    pub asset_mint: InterfaceAccount<'info, Mint>,

    // NOTE: This may be unnecessary as an account
    pub currency_mint: InterfaceAccount<'info, Mint>,

    #[account(
      init,
      payer = payer,
      seeds = [b"long_pool", asset_mint.key().as_ref(), currency_mint.key().as_ref()],
      bump,
      space = 8 + std::mem::size_of::<BasePool>(),
    )]
    pub long_pool: Box<Account<'info, BasePool>>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = asset_mint,
        associated_token::authority = long_pool,
        associated_token::token_program = token_program,
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = currency_mint,
        associated_token::authority = long_pool,
        associated_token::token_program = token_program,
    )]
    pub currency_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
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

    pub fn init_long_pool(&mut self, bumps: &InitLongPoolBumps) -> Result<()> {
        self.long_pool.set_inner(BasePool {
            is_long_pool: true,
            collateral: self.asset_mint.key(),
            collateral_vault: self.collateral_vault.key(),
            currency: self.currency_mint.key(),
            currency_vault: self.currency_vault.key(),
            bump: bumps.long_pool,
        });

        Ok(())
    }
}

//pub fn handler(ctx: Context<InitLongPool>) -> Result<()> {
//    let long_pool = &mut ctx.accounts.long_pool;
//    long_pool.is_long_pool = true;
//    long_pool.collateral = ctx.accounts.asset_mint.key();
//    long_pool.collateral_vault = ctx.accounts.collateral_vault.key();
//    long_pool.currency = ctx.accounts.currency_mint.key();
//    long_pool.currency_vault = ctx.accounts.currency_vault.key();
//    long_pool.bump = ctx.bumps.long_pool;
//
//    Ok(())
//}
