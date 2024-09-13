use anchor_lang::prelude::*;

use crate::{
    instructions::close_position_setup::*,
    short_pool_signer_seeds,
    CloseShortPositionCleanup,
};

#[derive(Accounts)]
pub struct CloseShortPositionSetup<'info> {
    pub close_position_setup: ClosePositionSetup<'info>,
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
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
        ctx.accounts.close_position_setup.pool.to_account_info(),
        &[short_pool_signer_seeds!(ctx.accounts.close_position_setup.pool)],
    )?;
    ctx.accounts.close_position_setup.set_close_position_request(&args)?;

    Ok(())
}
