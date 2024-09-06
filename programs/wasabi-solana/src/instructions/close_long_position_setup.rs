use anchor_lang::prelude::*;
use anchor_spl::token::{self, Approve, TokenAccount};

use crate::{instructions::close_position_setup::*, long_pool_signer_seeds, BasePool};

use super::CloseLongPositionCleanup;

#[derive(Accounts)]
pub struct CloseLongPositionSetup<'info> {
    pub close_position_setup: ClosePositionSetup<'info>,

    #[account(
      has_one = collateral_vault,
      seeds = [b"long_pool", collateral_vault.mint.as_ref(), close_position_setup.owner_currency_account.mint.as_ref()],
      bump,
    )]
    /// The LongPool that owns the Position
    pub long_pool: Account<'info, BasePool>,
    #[account(mut)]
    /// The collateral account that is the source of the swap
    pub collateral_vault: Account<'info, TokenAccount>,
}

impl<'info> CloseLongPositionSetup<'info> {
    pub fn approve_owner_delegation(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Approve {
            to: self.collateral_vault.to_account_info(),
            delegate: self.close_position_setup.owner.to_account_info(),
            authority: self.long_pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.close_position_setup.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[long_pool_signer_seeds!(self.long_pool)],
        };
        token::approve(cpi_ctx, amount)
    }
}

pub fn handler(ctx: Context<CloseLongPositionSetup>, args: ClosePositionArgs) -> Result<()> {
    ClosePositionSetup::validate(
        &ctx.accounts.close_position_setup,
        &args,
        CloseLongPositionCleanup::get_hash(),
    )?;
    // The user is long WIF and used SOL as downpayment. When closing the long WIF position we
    //  need to take all the WIF collateral and sell it for SOL.
    let position = &ctx.accounts.close_position_setup.position;
    // allow "owner" to swap on behalf of the collateral vault
    ctx.accounts
        .approve_owner_delegation(position.collateral_amount)?;
    // TODO: Pull the collateral from the LongPool vault
    // Create a close position request
    ctx.accounts.close_position_setup.set_close_position_request(&args)?;
    Ok(())
}
