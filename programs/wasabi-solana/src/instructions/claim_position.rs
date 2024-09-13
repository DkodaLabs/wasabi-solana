use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{DebtController, LpVault, Position};

#[derive(Accounts)]
pub struct ClaimPosition<'info> {
    #[account(mut)]
    /// The wallet that owns the Position
    pub trader: Signer<'info>,
    #[account(mut)]
    pub trader_currency_account: Account<'info, TokenAccount>,

    #[account(
      mut,
      close = trader,
      has_one = trader,
      has_one = lp_vault,
    )]
    pub position: Account<'info, Position>,

    #[account(
      has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
      seeds = [b"debt_controller"],
      bump,
    )]
    pub debt_controller: Account<'info, DebtController>,

    pub token_program: Program<'info, Token>,
}
impl<'info> ClaimPosition<'info> {
    pub fn transfer_from_trader_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.trader_currency_account.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.trader.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)
    }
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct ClaimPositionArgs {}

pub fn handler(ctx: Context<ClaimPosition>, _args: ClaimPositionArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    // Transfer the interest and principal
    let position = &ctx.accounts.position;
    let interest_paid = ctx.accounts.debt_controller.compute_max_interest(
        position.principal,
        position.last_funding_timestamp,
        now,
    )?;
    let amount_owed = position.principal.checked_add(interest_paid).expect("overflow");
    ctx.accounts.transfer_from_trader_to_vault(amount_owed)?;

    Ok(())
}
