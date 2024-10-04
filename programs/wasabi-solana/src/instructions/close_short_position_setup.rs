use anchor_lang::prelude::*;

use crate::{
    error::ErrorCode, instructions::close_position_setup::*, short_pool_signer_seeds,
    CloseShortPositionCleanup,
};

#[derive(Accounts)]
pub struct CloseShortPositionSetup<'info> {
    pub close_position_setup: ClosePositionSetup<'info>,
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
}

impl<'info> CloseShortPositionSetup<'info> {
    pub fn validate(
        ctx: &Context<CloseShortPositionSetup>,
        args: &ClosePositionArgs,
    ) -> Result<()> {
        require!(
            ctx.accounts.owner.key() == ctx.accounts.close_position_setup.owner.key(),
            ErrorCode::IncorrectOwner
        );

        if !ctx
            .accounts
            .close_position_setup
            .permission
            .can_cosign_swaps()
        {
            return Err(ErrorCode::InvalidSwapCosigner.into());
        }

        ClosePositionSetup::validate(
            &ctx.accounts.close_position_setup,
            &args,
            CloseShortPositionCleanup::get_hash(),
        )?;

        Ok(())
    }
}

pub fn handler(ctx: Context<CloseShortPositionSetup>, args: ClosePositionArgs) -> Result<()> {
    let position = &ctx.accounts.close_position_setup.position;
    // allow "owner" to swap on behalf of the collateral vault
    ctx.accounts
        .close_position_setup
        .approve_swap_authority_delegation(
            position.collateral_amount,
            ctx.accounts.close_position_setup.pool.to_account_info(),
            &[short_pool_signer_seeds!(
                ctx.accounts.close_position_setup.pool
            )],
        )?;
    ctx.accounts
        .close_position_setup
        .set_close_position_request(&args)?;

    Ok(())
}
