use anchor_lang::prelude::*;

use crate::{
    error::ErrorCode, instructions::close_position_setup::*, long_pool_signer_seeds,
    short_pool_signer_seeds,
};

use super::TakeProfitCleanup;

#[derive(Accounts)]
pub struct TakeProfitSetup<'info> {
    pub close_position_setup: ClosePositionSetup<'info>,
}

impl<'info> TakeProfitSetup<'info> {
    pub fn validate(ctx: Context<TakeProfitSetup>) -> Result<()> {
        // Validate the authority can co-sign swaps
        require!(
            ctx.accounts
                .close_position_setup
                .permission
                .can_cosign_swaps(),
            ErrorCode::InvalidPermissions
        );

        Ok(())
    }
}

pub fn handler(ctx: Context<TakeProfitSetup>, args: ClosePositionArgs) -> Result<()> {
    ClosePositionSetup::validate(
        &ctx.accounts.close_position_setup,
        &args,
        TakeProfitCleanup::get_hash(),
    )?;
    let position = &ctx.accounts.close_position_setup.position;

    // allow "authority" to swap on behalf of the collateral vault
    if ctx.accounts.close_position_setup.pool.is_long_pool {
        ctx.accounts
            .close_position_setup
            .approve_swap_authority_delegation(
                position.collateral_amount,
                ctx.accounts.close_position_setup.pool.to_account_info(),
                &[long_pool_signer_seeds!(
                    ctx.accounts.close_position_setup.pool
                )],
            )?;
    } else {
        ctx.accounts
            .close_position_setup
            .approve_swap_authority_delegation(
                position.collateral_amount,
                ctx.accounts.close_position_setup.pool.to_account_info(),
                &[short_pool_signer_seeds!(
                    ctx.accounts.close_position_setup.pool
                )],
            )?;
    }

    // Create a close position request
    ctx.accounts
        .close_position_setup
        .set_close_position_request(&args)?;
    Ok(())
}
