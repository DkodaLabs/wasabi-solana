use {
    crate::{error::ErrorCode, BasePool, Permission},
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::AssociatedToken,
        token_interface::{Mint, TokenAccount, TokenInterface},
    },
};

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

    pub collateral: InterfaceAccount<'info, Mint>,
    pub currency: InterfaceAccount<'info, Mint>,

    #[account(
      init,
      payer = payer,
      seeds = [b"short_pool", collateral.key().as_ref(), currency.key().as_ref()],
      bump,
      space = 8 + std::mem::size_of::<BasePool>(),
    )]
    pub short_pool: Account<'info, BasePool>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = collateral,
        associated_token::authority = short_pool,
        associated_token::token_program = collateral_token_program,
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = currency,
        associated_token::authority = short_pool,
        associated_token::token_program = currency_token_program,
    )]
    pub currency_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral_token_program: Interface<'info, TokenInterface>,
    pub currency_token_program: Interface<'info, TokenInterface>,
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
            collateral: self.collateral.key(),
            collateral_vault: self.collateral_vault.key(),
            currency: self.currency.key(),
            currency_vault: self.currency_vault.key(),
            bump: bumps.short_pool,
        });

        Ok(())
    }
}