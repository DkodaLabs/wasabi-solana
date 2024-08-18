use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::{lp_vault_signer_seeds, LpVault};

#[derive(Accounts)]
pub struct DepositOrWithdraw<'info> {
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

impl<'info> DepositOrWithdraw<'info> {
    pub fn transfer_token_from_owner_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.owner_asset_account.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)
    }

    pub fn mint_shares_to_user(&self, amount: u64) -> Result<()> {
        let cpi_accounts = MintTo {
            mint: self.shares_mint.to_account_info(),
            to: self.owner_shares_account.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };
        token::mint_to(cpi_ctx, amount)
    }
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct DepositArgs {
    /// The amount of assets to deposit
    amount: u64,
}

pub fn handler(ctx: Context<DepositOrWithdraw>, args: DepositArgs) -> Result<()> {
    // transfer tokens from user's asset account
    ctx.accounts
        .transfer_token_from_owner_to_vault(args.amount)?;

    // Mint share tokens to the user
    let shares_supply = ctx.accounts.shares_mint.supply;
    let shares_to_mint =  if shares_supply == 0 {
      args.amount
    } else {
      // shares to mint is (amount/total_assets) * shares_supply
      shares_supply
      .checked_mul(args.amount)
      .expect("overflow")
      .checked_div(ctx.accounts.lp_vault.total_assets)
      .expect("overflow")
    };
    ctx.accounts.mint_shares_to_user(shares_to_mint)?;

    // Update the LpVault for total assets deposited.
    let lp_vault = &mut ctx.accounts.lp_vault;
    lp_vault.total_assets = lp_vault
        .total_assets
        .checked_add(args.amount)
        .expect("overflow");

    Ok(())
}
