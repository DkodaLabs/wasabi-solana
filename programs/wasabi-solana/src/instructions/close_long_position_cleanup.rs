use anchor_lang::prelude::*;
use anchor_spl::token::{self, Revoke, Token, TokenAccount};

use crate::{long_pool_signer_seeds, utils::get_function_hash, BasePool, ClosePositionRequest, Position};

#[derive(Accounts)]
pub struct CloseLongPositionCleanup<'info> {
    owner: Signer<'info>,

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


    pub token_program: Program<'info, Token>,
    
}

impl<'info> CloseLongPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "close_long_position_cleanup")
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
}

pub fn handler(ctx: Context<CloseLongPositionCleanup>) -> Result<()> {
    // revoke "owner" ability to swap on behalf of the collateral vault
    ctx.accounts.revoke_owner_delegation()?;
    // TODO: Transfer the interest amount to the LP Vault
    Ok(())
}
