use anchor_lang::prelude::*;
use anchor_spl::token::{self, Revoke, Token, TokenAccount, Transfer};

use crate::{
    error::ErrorCode, short_pool_signer_seeds, utils::get_function_hash, BasePool,
    ClosePositionRequest, LpVault, Position,
};

#[derive(Accounts)]
pub struct CloseShortPositionCleanup<'info> {
    #[account(mut)]
    owner: Signer<'info>,

    #[account(mut)]
    /// The account that holds the owner's base currency
    pub owner_currency_account: Account<'info, TokenAccount>,

    #[account(
      has_one = collateral_vault,
    )]
    /// The ShortPool that owns the Position
    pub short_pool: Account<'info, BasePool>,

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

impl<'info> CloseShortPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "close_short_position_cleanup")
    }

    pub fn validate(&self) -> Result<()> {
        // Validate the same position was used in setup and cleanup
        if self.position.key() != self.close_position_request.position {
            return Err(ErrorCode::InvalidPosition.into());
        }
        // Validate the same pool, and thus collateral_vault was used in setup and cleanup.
        if self.short_pool.key() != self.close_position_request.pool_key {
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

    pub fn revoke_owner_delegation(&self) -> Result<()> {
        let cpi_accounts = Revoke {
            source: self.collateral_vault.to_account_info(),
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

pub fn handler(ctx: Context<CloseShortPositionCleanup>) -> Result<()> {
    // revoke "owner" ability to swap on behalf of the collateral vault
    ctx.accounts.revoke_owner_delegation()?;

    let close_position_request = &ctx.accounts.close_position_request;
    let collateral_diff = ctx.accounts.get_source_delta();
    let currency_diff = ctx.accounts.get_destination_delta();
    if collateral_diff < ctx.accounts.position.collateral_amount {
        let collateral_dust = ctx.accounts.position.collateral_amount - collateral_diff;
        // TODO: What to do with any collateral_dust?
        msg!("collateral_dust: {}", collateral_dust);
    }

    // TODO: Cap the interest with a max interest ([EVM source](https://github.com/DkodaLabs/wasabi_perps/blob/4f597e6293e0de00c6133af7cffd3a680f463d6c/contracts/BaseWasabiPool.sol#L188))

    let lp_vault_payment = ctx
        .accounts
        .position
        .principal
        .checked_add(close_position_request.interest)
        .expect("overflow");
    if currency_diff < lp_vault_payment {
        return Err(ErrorCode::BadDebt.into());
    }

    ctx.accounts.transfer_from_user_to_vault(lp_vault_payment)?;

    // The rest is left over in the user account
    Ok(())
}
