use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{
    error::ErrorCode, short_pool_signer_seeds, BasePool, DebtController, GlobalSettings, LpVault,
    Position,
};

use super::close_position_cleanup::CloseAmounts;

#[derive(Accounts)]
pub struct ClaimPosition<'info> {
    #[account(mut)]
    /// The wallet that owns the Position
    pub trader: Signer<'info>,
    #[account(mut)]
    pub trader_currency_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_collateral_account: Account<'info, TokenAccount>,

    #[account(
      mut,
      close = trader,
      has_one = trader,
      has_one = lp_vault,
      has_one = collateral_vault,
    )]
    pub position: Account<'info, Position>,

    #[account(
      has_one = collateral_vault,
    )]
    pub pool: Account<'info, BasePool>,

    #[account(mut)]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(
      has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub fee_wallet: Account<'info, TokenAccount>,

    #[account(
      seeds = [b"debt_controller"],
      bump,
    )]
    pub debt_controller: Account<'info, DebtController>,

    #[account(
      seeds = [b"global_settings"],
      bump,
    )]
    pub global_settings: Account<'info, GlobalSettings>,

    pub token_program: Program<'info, Token>,
}
impl<'info> ClaimPosition<'info> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.fee_wallet.owner == self.global_settings.protocol_fee_wallet,
            ErrorCode::IncorrectFeeWallet
        );
        Ok(())
    }

    pub fn transfer_from_trader_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.trader_currency_account.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.trader.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)
    }

    pub fn transfer_from_collateral_vault_to_trader(
        &self,
        amount: u64,
        pool_signer: &[&[&[u8]]],
    ) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.collateral_vault.to_account_info(),
            to: self.trader_collateral_account.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: pool_signer,
        };
        token::transfer(cpi_ctx, amount)
    }

    pub fn transfer_fees(&self, amount: u64, pool_signer: &[&[&[u8]]]) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.collateral_vault.to_account_info(),
            to: self.fee_wallet.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: pool_signer,
        };
        token::transfer(cpi_ctx, amount)
    }
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct ClaimPositionArgs {}

pub fn handler(ctx: Context<ClaimPosition>, _args: ClaimPositionArgs) -> Result<()> {
    ctx.accounts.validate()?;
    let now = Clock::get()?.unix_timestamp;

    // Transfer the interest and principal
    let position = &ctx.accounts.position;
    let interest_paid = ctx.accounts.debt_controller.compute_max_interest(
        position.principal,
        position.last_funding_timestamp,
        now,
    )?;
    let amount_owed = position
        .principal
        .checked_add(interest_paid)
        .expect("overflow");
    ctx.accounts.transfer_from_trader_to_vault(amount_owed)?;

    let close_fee = position.fees_to_be_paid;
    let claim_amount = position.collateral_amount - close_fee;

    let close_amounts = CloseAmounts {
        payout: claim_amount,
        interest_paid,
        principal_repaid: position.principal,
        close_fee,
    };

    // pay out the collateral (claim_amount)
    ctx.accounts.transfer_from_collateral_vault_to_trader(
        claim_amount,
        &[short_pool_signer_seeds!(ctx.accounts.pool)],
    )?;

    // pay out the close fees
    ctx.accounts.transfer_fees(
        close_amounts.close_fee,
        &[short_pool_signer_seeds!(ctx.accounts.pool)],
    )?;

    // TODO: Emit the PositionClaimed event

    Ok(())
}
