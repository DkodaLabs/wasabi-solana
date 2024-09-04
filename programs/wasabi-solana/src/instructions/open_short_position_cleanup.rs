use anchor_lang::prelude::*;
use anchor_spl::token::{self, Revoke, Token, TokenAccount};

use crate::{
    error::ErrorCode, short_pool_signer_seeds, utils::get_function_hash, BasePool,
    OpenPositionRequest, Position,
};

#[derive(Accounts)]
pub struct OpenShortPositionCleanup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,

    #[account(
      has_one = collateral_vault,
      has_one = currency_vault,
    )]
    /// The ShortPool that owns the Position
    pub short_pool: Account<'info, BasePool>,
    /// The collateral account that is the destination of the swap
    pub collateral_vault: Account<'info, TokenAccount>,
    // The token account that is the source of the swap (where principal and downpayment are sent)
    pub currency_vault: Box<Account<'info, TokenAccount>>,

    #[account(
      mut,
      close = owner,
      seeds = [b"open_pos", owner.key().as_ref()],
      bump,
    )]
    pub open_position_request: Account<'info, OpenPositionRequest>,

    #[account(mut)]
    pub position: Account<'info, Position>,

    pub token_program: Program<'info, Token>,
}

impl<'info> OpenShortPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "open_short_position_cleanup")
    }

    pub fn get_destination_delta(&self) -> u64 {
        self.collateral_vault
            .amount
            .checked_sub(self.open_position_request.swap_cache.destination_bal_before)
            .expect("overflow")
    }

    pub fn get_source_delta(&self) -> u64 {
        self.open_position_request
            .swap_cache
            .source_bal_before
            .checked_sub(self.currency_vault.amount)
            .expect("overflow")
    }

    pub fn validate(&self) -> Result<()> {
        // Validate the same position was used in setup and cleanup
        if self.position.key() != self.open_position_request.position {
            return Err(ErrorCode::InvalidPosition.into());
        }
        // Validate the same pool, and thus collateral_vault was used in setup and cleanup.
        if self.short_pool.key() != self.open_position_request.pool_key {
            return Err(ErrorCode::InvalidPool.into());
        }

        // Validate owner receives at least the minimum amount of token being swapped to.
        let destination_balance_delta = self.get_destination_delta();

        if destination_balance_delta < self.open_position_request.min_target_amount {
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
            source: self.currency_vault.to_account_info(),
            authority: self.short_pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[short_pool_signer_seeds!(self.short_pool)],
        };
        token::revoke(cpi_ctx)
    }
}

pub fn handler(ctx: Context<OpenShortPositionCleanup>) -> Result<()> {
    ctx.accounts.validate()?;
    // Revoke owner's ability to transfer on behalf of the `currency_vault`
    ctx.accounts.revoke_owner_delegation()?;

    let destination_delta = ctx.accounts.get_destination_delta();

    let position = &mut ctx.accounts.position;
    position.collateral_amount = destination_delta;
    Ok(())
}
