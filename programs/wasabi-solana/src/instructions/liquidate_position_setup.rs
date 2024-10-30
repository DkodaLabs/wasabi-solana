use {
    super::liquidate_position_cleanup::LiquidatePositionCleanup,
    crate::{
        error::ErrorCode, instructions::close_position_setup::*, long_pool_signer_seeds,
        short_pool_signer_seeds,
    },
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct LiquidatePositionSetup<'info> {
    pub close_position_setup: ClosePositionSetup<'info>,
}

impl<'info> LiquidatePositionSetup<'info> {
    pub fn validate(ctx: &Context<LiquidatePositionSetup>, expiration: i64) -> Result<()> {
        // Validate the authority has liquidate authority
        require!(
            ctx.accounts.close_position_setup.permission.can_liquidate(),
            ErrorCode::InvalidPermissions
        );

        ClosePositionSetup::validate(
            &ctx.accounts.close_position_setup,
            expiration,
            LiquidatePositionCleanup::get_hash(),
        )?;

        Ok(())
    }

    pub fn liquidate_position_setup(
        &mut self,
        min_target_amount: u64,
        interest: u64,
        execution_fee: u64,
        expiration: i64,
    ) -> Result<()> {
        if self.close_position_setup.pool.is_long_pool {
            self.close_position_setup
                .approve_swap_authority_delegation(
                    self.close_position_setup.position.collateral_amount,
                    self.close_position_setup.pool.to_account_info(),
                    &[long_pool_signer_seeds!(self.close_position_setup.pool)],
                )?;
        } else {
            self.close_position_setup.approve_swap_authority_delegation(
            self.close_position_setup.position.collateral_amount,
                self.close_position_setup.pool.to_account_info(),
                &[short_pool_signer_seeds!(self.close_position_setup.pool)],
            )?;
        }

        self.close_position_setup.set_close_position_request(
            min_target_amount,
            interest,
            execution_fee,
            expiration,
        )?;

        Ok(())
    }
}

//pub fn handler(ctx: Context<LiquidatePositionSetup>, args: ClosePositionArgs) -> Result<()> {
//    let position = &ctx.accounts.close_position_setup.position;
//    // allow "owner" to swap on behalf of the collateral vault
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
