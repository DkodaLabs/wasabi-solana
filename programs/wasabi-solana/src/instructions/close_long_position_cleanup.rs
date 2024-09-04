use anchor_lang::prelude::*;
use anchor_spl::token::{self, Revoke, Token, TokenAccount, Transfer};

use crate::{
    error::ErrorCode, long_pool_signer_seeds, utils::get_function_hash, BasePool,
    ClosePositionRequest, LpVault, Position,
};

#[derive(Accounts)]
pub struct CloseLongPositionCleanup<'info> {
    owner: Signer<'info>,
    #[account(mut)]
    /// The account that holds the owner's base currency
    pub owner_currency_account: Account<'info, TokenAccount>,

    #[account(
      has_one = collateral_vault,
    )]
    /// The LongPool that owns the Position
    pub long_pool: Account<'info, BasePool>,

    pub collateral_vault: Account<'info, TokenAccount>,
    #[account(
      mut,
      close = owner,
      seeds = [b"close_pos", owner.key().as_ref()],
      bump,
    )]
    pub close_position_request: Account<'info, ClosePositionRequest>,

    #[account(
      mut,
      close = owner,
      has_one = collateral_vault,
    )]
    pub position: Account<'info, Position>,

    /// The LP Vault that the user borrowed from
    #[account(
      has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,
    #[account(mut)]
    /// The LP Vault's token account.
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> CloseLongPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "close_long_position_cleanup")
    }

    pub fn get_destination_delta(&self) -> u64 {
        self.owner_currency_account
            .amount
            .checked_sub(
                self.close_position_request
                    .swap_cache
                    .destination_bal_before,
            )
            .expect("overflow")
    }

    pub fn get_source_delta(&self) -> u64 {
        self.close_position_request
            .swap_cache
            .source_bal_before
            .checked_sub(self.collateral_vault.amount)
            .expect("overflow")
    }

    pub fn validate(&self) -> Result<()> {
        // Validate the same position was used in setup and cleanup
        if self.position.key() != self.close_position_request.position {
            return Err(ErrorCode::InvalidPosition.into());
        }
        // Validate the same pool, and thus collateral_vault was used in setup and cleanup.
        if self.long_pool.key() != self.close_position_request.pool_key {
            return Err(ErrorCode::InvalidPool.into());
        }

        // Validate owner receives at least the minimum amount of token being swapped to.
        let destination_balance_delta = self.get_destination_delta();

        if destination_balance_delta < self.close_position_request.min_target_amount {
            return Err(ErrorCode::MinTokensNotMet.into());
        }

        let source_balance_delta = self.get_source_delta();

        if source_balance_delta > 0 {
            return Err(ErrorCode::MaxSwapExceeded.into());
        }

        Ok(())
    }

    pub fn revoke_owner_delegation(&self) -> Result<()> {
        let cpi_accounts = Revoke {
            source: self.collateral_vault.to_account_info(),
            authority: self.long_pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[long_pool_signer_seeds!(self.long_pool)],
        };
        token::revoke(cpi_ctx)
    }

    pub fn transfer_from_user_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.owner_currency_account.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)
    }
}

pub fn handler(ctx: Context<CloseLongPositionCleanup>) -> Result<()> {
    // revoke "owner" ability to swap on behalf of the collateral vault
    ctx.accounts.revoke_owner_delegation()?;
    // Total currency received after the swap.
    let close_position_request = &ctx.accounts.close_position_request;
    let collateral_diff = ctx.accounts.get_source_delta();
    let currency_diff = ctx.accounts.get_destination_delta();

    if collateral_diff < ctx.accounts.position.collateral_amount {
        let collateral_dust = ctx.accounts.position.collateral_amount - collateral_diff;
        // TODO: What to do with any collateral_dust?
        msg!("collateral_dust: {}", collateral_dust);
    }

    // TODO: Cap the interest with a max interest ([EVM source](https://github.com/DkodaLabs/wasabi_perps/blob/4f597e6293e0de00c6133af7cffd3a680f463d6c/contracts/BaseWasabiPool.sol#L188))

    // Transfer the prinicpal and interest amount to the LP Vault
    let lp_vault_payment = ctx
        .accounts
        .position
        .principal
        .checked_add(close_position_request.interest)
        .expect("overflow");
    ctx.accounts.transfer_from_user_to_vault(lp_vault_payment)?;
    if currency_diff < lp_vault_payment {
        // TODO: If currency_diff < prinicpal + interest then there's bad debt. throw error?
        msg!("Bad debt");
    }
    // The rest is left over in the user account
    Ok(())
}
