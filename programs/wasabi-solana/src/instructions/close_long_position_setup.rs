use anchor_lang::prelude::*;

use crate::{error::ErrorCode, instructions::close_position_setup::*, long_pool_signer_seeds};

use super::CloseLongPositionCleanup;

#[derive(Accounts)]
pub struct CloseLongPositionSetup<'info> {
    pub close_position_setup: ClosePositionSetup<'info>,
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
}

impl<'info> CloseLongPositionSetup<'info> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.owner.key() == self.close_position_setup.owner.key(),
            ErrorCode::IncorrectOwner
        );
        Ok(())
    }
}

pub fn handler(ctx: Context<CloseLongPositionSetup>, args: ClosePositionArgs) -> Result<()> {
    // Local validations
    ctx.accounts.validate()?;

    // Shared validations
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
        .close_position_setup
        .approve_swap_authority_delegation(
            position.collateral_amount,
            ctx.accounts.close_position_setup.pool.to_account_info(),
            &[long_pool_signer_seeds!(
                ctx.accounts.close_position_setup.pool
            )],
        )?;

    // Create a close position request
    ctx.accounts
        .close_position_setup
        .set_close_position_request(&args)?;
    Ok(())
}
