use {
    super::CloseLongPositionCleanup,
    crate::{error::ErrorCode, instructions::close_position_setup::*, long_pool_signer_seeds},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct CloseLongPositionSetup<'info> {
    pub close_position_setup: ClosePositionSetup<'info>,
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
}

impl<'info> CloseLongPositionSetup<'info> {
    pub fn validate(ctx: &Context<CloseLongPositionSetup>, expiration: i64) -> Result<()> {
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
            ErrorCode::InvalidSwapCosigner,
        );

        ClosePositionSetup::validate(
            &ctx.accounts.close_position_setup,
            expiration,
            CloseLongPositionCleanup::get_hash(),
        )?;

        Ok(())
    }

    // The user is long WIF and used SOL as downpayment. When closing the long WIF position we
    // need to take all the WIF collateral and sell it for SOL.
    pub fn close_long_position_setup(
        &mut self,
        min_target_amount: u64,
        interest: u64,
        execution_fee: u64,
        expiration: i64,
    ) -> Result<()> {
        // Allow "owner" to swap on behalf of the collateral vault
        let cps = &mut self.close_position_setup;
        cps.approve_swap_authority_delegation(
            cps.position.collateral_amount,
            cps.pool.to_account_info(),
            &[long_pool_signer_seeds!(cps.pool)],
        )?;

        // Create a close position request
        cps.set_close_position_request(
            min_target_amount,
            interest,
            execution_fee,
            expiration,
        )?;

        Ok(())
    }
}

//pub fn handler(ctx: Context<CloseLongPositionSetup>, args: ClosePositionArgs) -> Result<()> {
//    // The user is long WIF and used SOL as downpayment. When closing the long WIF position we
//    //  need to take all the WIF collateral and sell it for SOL.
//    let position = &ctx.accounts.close_position_setup.position;
//    // allow "owner" to swap on behalf of the collateral vault
//    ctx.accounts
//        .close_position_setup
//        .approve_swap_authority_delegation(
//            position.collateral_amount,
//            ctx.accounts.close_position_setup.pool.to_account_info(),
//            &[long_pool_signer_seeds!(
//                ctx.accounts.close_position_setup.pool
//            )],
//        )?;
//
//    // Create a close position request
//    ctx.accounts
//        .close_position_setup
//        .set_close_position_request(&args)?;
//    Ok(())
//}
