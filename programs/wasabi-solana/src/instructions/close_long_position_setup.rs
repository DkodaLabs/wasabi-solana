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
    ctx.accounts.close_position_setup.approve_owner_delegation(
        position.collateral_amount,
        ctx.accounts.long_pool.to_account_info(),
        &[long_pool_signer_seeds!(ctx.accounts.long_pool)],
    )?;
    // TODO: Pull the collateral from the LongPool vault
    // Create a close position request
    ctx.accounts
        .close_position_setup
        .set_close_position_request(&args)?;
    Ok(())
}
