use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{lp_vault, LpVault};

#[derive(Accounts)]
pub struct Deposit<'info> {
    /// The key of the user that owns the assets
    pub owner: Signer<'info>,

    #[account(mut)]
    /// The Owner's tokena account that holds the assets
    pub owner_asset_account: Account<'info, TokenAccount>,

    #[account(mut)]
    /// The Owner's token account that stores share tokens
    pub owner_shares_account: Account<'info, TokenAccount>,

    #[account(
    mut,
    has_one = vault,
    has_one = shares_mint,
  )]
    pub lp_vault: Account<'info, LpVault>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub shares_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Deposit<'info> {
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

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct DepositArgs {
    /// The amount of assets to deposit
    amount: u64,
}

pub fn handler(ctx: Context<Deposit>, args: DepositArgs) -> Result<()> {
    // transfer tokens from user's asset account
    ctx.accounts
        .transfer_token_from_owner_to_vault(args.amount)?;
    // TODO: Mint share tokens to the user

    // Update the LpVault for total assets deposited.
    let lp_vault = &mut ctx.accounts.lp_vault;
    lp_vault.total_assets = lp_vault.total_assets.checked_add(args.amount).expect("overflow");

    Ok(())
}
