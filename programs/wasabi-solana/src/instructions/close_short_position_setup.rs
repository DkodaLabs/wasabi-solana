use {
    crate::{
        error::ErrorCode, instructions::close_position_setup::*, short_pool_signer_seeds,
        CloseShortPositionCleanup,
    },
    anchor_lang::prelude::*,
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
        expiration: i64,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.owner.key(),
            ctx.accounts.close_position_setup.owner.key(),
            ErrorCode::IncorrectOwner
        );

        require!(
            ctx.accounts
                .close_position_setup
                .permission
                .can_cosign_swaps(),
            ErrorCode::InvalidSwapCosigner
        );

        ClosePositionSetup::validate(
            &ctx.accounts.close_position_setup,
            expiration,
            CloseShortPositionCleanup::get_hash(),
        )?;

        Ok(())
    }

    pub fn close_short_position_setup(
        &mut self,
        min_target_amount: u64,
        interest: u64,
        execution_fee: u64,
        expiration: i64,
    ) -> Result<()> {
        self.close_position_setup
            .approve_swap_authority_delegation(
                self.close_position_setup.position.collateral_amount,
                self.close_position_setup.pool.to_account_info(),
                &[short_pool_signer_seeds!(self.close_position_setup.pool)],
            )?;

        self.close_position_setup
            .set_close_position_request(
                min_target_amount,
                interest,
                execution_fee,
                expiration,
            )?;

        Ok(())
    }
}

//pub fn handler(ctx: Context<CloseShortPositionSetup>, args: ClosePositionArgs) -> Result<()> {
//    let position = &ctx.accounts.close_position_setup.position;
//    // allow "owner" to swap on behalf of the collateral vault
//    ctx.accounts
//        .close_position_setup
//        .approve_swap_authority_delegation(
//            position.collateral_amount,
//            ctx.accounts.close_position_setup.pool.to_account_info(),
//            &[short_pool_signer_seeds!(
//                ctx.accounts.close_position_setup.pool
//            )],
//        )?;
//    ctx.accounts
//        .close_position_setup
//        .set_close_position_request(&args)?;
//
//    Ok(())
//}
