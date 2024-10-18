use {
    super::StopLossCleanup,
    crate::{
        error::ErrorCode, instructions::close_position_setup::*, long_pool_signer_seeds,
        short_pool_signer_seeds,
    },
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct StopLossSetup<'info> {
    pub close_position_setup: ClosePositionSetup<'info>,
}

impl<'info> StopLossSetup<'info> {
    pub fn validate(ctx: &Context<StopLossSetup>, args: &ClosePositionArgs) -> Result<()> {
        // Validate the authority can co-sign swaps
        require!(
            ctx.accounts
                .close_position_setup
                .permission
                .can_cosign_swaps(),
            ErrorCode::InvalidPermissions
        );

        ClosePositionSetup::validate(
            &ctx.accounts.close_position_setup,
            &args,
            StopLossCleanup::get_hash(),
        )?;

        Ok(())
    }

    pub fn stop_loss_setup(&mut self, args: &ClosePositionArgs) -> Result<()> {
        if self.close_position_setup.pool.is_long_pool {
            self.close_position_setup
                .approve_swap_authority_delegation(
                    self.close_position_setup.position.collateral_amount,
                    self.close_position_setup.pool.to_account_info(),
                    &[long_pool_signer_seeds!(self.close_position_setup.pool)],
                )?;
        } else {
            self.close_position_setup
                .approve_swap_authority_delegation(
                    self.close_position_setup.position.collateral_amount,
                    self.close_position_setup.pool.to_account_info(),
                    &[short_pool_signer_seeds!(self.close_position_setup.pool)],
                )?;
        }

        self.close_position_setup
            .set_close_position_request(&args)?;

        Ok(())
    }
}

//pub fn handler(ctx: Context<StopLossSetup>, args: ClosePositionArgs) -> Result<()> {
//    let position = &ctx.accounts.close_position_setup.position;
//
//    // allow "authority" to swap on behalf of the collateral vault
//    if ctx.accounts.close_position_setup.pool.is_long_pool {
//        ctx.accounts
//            .close_position_setup
//            .approve_swap_authority_delegation(
//                position.collateral_amount,
//                ctx.accounts.close_position_setup.pool.to_account_info(),
//                &[long_pool_signer_seeds!(
//                    ctx.accounts.close_position_setup.pool
//                )],
//            )?;
//    } else {
//        ctx.accounts
//            .close_position_setup
//            .approve_swap_authority_delegation(
//                position.collateral_amount,
//                ctx.accounts.close_position_setup.pool.to_account_info(),
//                &[short_pool_signer_seeds!(
//                    ctx.accounts.close_position_setup.pool
//                )],
//            )?;
//    }
//
//    // Create a close position request
//    ctx.accounts
//        .close_position_setup
//        .set_close_position_request(&args)?;
//    Ok(())
//}
