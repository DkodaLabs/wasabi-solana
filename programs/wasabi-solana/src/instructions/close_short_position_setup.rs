use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::{
    instructions::close_position_setup::*,
    short_pool_signer_seeds,
    BasePool,
    CloseShortPositionCleanup,
};

#[derive(Accounts)]
pub struct CloseShortPositionSetup<'info> {
    pub close_position_setup: ClosePositionSetup<'info>,

    #[account(
      has_one = collateral_vault,
      seeds = [b"short_pool", collateral_vault.mint.as_ref(), close_position_setup.owner_currency_account.mint.as_ref()],
      bump,
    )]
    /// The ShortPool that owns the Position
    pub short_pool: Account<'info, BasePool>,
    #[account(mut)]
    /// The collateral account that is the source of the swap
    pub collateral_vault: Account<'info, TokenAccount>,
}

pub fn handler(
    ctx: Context<CloseShortPositionSetup>,
    args: ClosePositionArgs,
) -> Result<()> {
    ClosePositionSetup::validate(
        &ctx.accounts.close_position_setup,
        &args,
        CloseShortPositionCleanup::get_hash(),
    )?;
    let position = &ctx.accounts.close_position_setup.position;
    // allow "owner" to swap on behalf of the collateral vault
    ctx.accounts.close_position_setup.approve_owner_delegation(
        position.collateral_amount,
        ctx.accounts.short_pool.to_account_info(),
        &[short_pool_signer_seeds!(ctx.accounts.short_pool)],
    )?;

    ctx.accounts.close_position_setup.set_close_position_request(&args)?;

    Ok(())
}
