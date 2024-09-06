use anchor_lang::prelude::*;

use crate::{error::ErrorCode, instructions::close_position_setup::*, long_pool_signer_seeds, short_pool_signer_seeds};

use super::liquidate_position_cleanup::LiquidatePositionCleanup;

#[derive(Accounts)]
pub struct LiquidatePositionSetup<'info> {
    pub close_position_setup: ClosePositionSetup<'info>,
}

impl<'info> LiquidatePositionSetup<'info> {
  pub fn validate(ctx: Context<LiquidatePositionSetup>) -> Result<()> {
    // Validate the authority has liquidate authority
    require!(ctx.accounts.close_position_setup.permission.can_liquidate(), ErrorCode::InvalidPermissions);

    Ok(())
  }
}


pub fn handler(ctx: Context<LiquidatePositionSetup>, args: ClosePositionArgs) -> Result<()> {
    ClosePositionSetup::validate(
        &ctx.accounts.close_position_setup,
        &args,
        LiquidatePositionCleanup::get_hash(),
    )?;
    // The user is long WIF and used SOL as downpayment. When closing the long WIF position we
    //  need to take all the WIF collateral and sell it for SOL.
    let position = &ctx.accounts.close_position_setup.position;
    // allow "owner" to swap on behalf of the collateral vault
    if ctx.accounts.close_position_setup.pool.is_long_pool {
      ctx.accounts.close_position_setup.approve_owner_delegation(
        position.collateral_amount,
        ctx.accounts.close_position_setup.pool.to_account_info(),
        &[long_pool_signer_seeds!(ctx.accounts.close_position_setup.pool)],
      )?;
    } else {
      ctx.accounts.close_position_setup.approve_owner_delegation(
        position.collateral_amount,
        ctx.accounts.close_position_setup.pool.to_account_info(),
        &[short_pool_signer_seeds!(ctx.accounts.close_position_setup.pool)],
      )?;
    }

    // Create a close position request
    ctx.accounts.close_position_setup.set_close_position_request(&args)?;
    Ok(())
}
