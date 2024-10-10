use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{events::NativeYieldClaimed, LpVault};

#[derive(Accounts)]
pub struct Donate<'info> {
    /// The key of the address donating
    pub owner: Signer<'info>,

    #[account(mut)]
    /// The Payer's token account that holds the assets
    pub owner_asset_account: Account<'info, TokenAccount>,

    #[account(
      mut,
      has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct DonateArgs {
    pub amount: u64,
}

impl<'info> Donate<'info> {
    pub fn transfer_token_from_owner_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.owner_asset_account.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)
    }
}

pub fn handler(ctx: Context<Donate>, args: DonateArgs) -> Result<()> {
    // Transfer tokens from payer to vault
    ctx.accounts
        .transfer_token_from_owner_to_vault(args.amount)?;

    // Update the LpVault for total assets deposited.
    let lp_vault = &mut ctx.accounts.lp_vault;
    lp_vault.total_assets = lp_vault
        .total_assets
        .checked_add(args.amount)
        .expect("overflow");

    emit!(NativeYieldClaimed {
        source: ctx.accounts.owner.key(),
        vault: ctx.accounts.vault.key(),
        token: ctx.accounts.lp_vault.asset,
        amount: args.amount,
    });

    Ok(())
}
