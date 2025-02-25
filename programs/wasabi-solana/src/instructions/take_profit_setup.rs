use {
    super::TakeProfitCleanup,
    crate::{
        error::ErrorCode, instructions::close_position_setup::*, long_pool_signer_seeds,
        short_pool_signer_seeds,
    },
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct TakeProfitSetup<'info> {
    pub close_position_setup: ClosePositionSetup<'info>,
}

impl<'info> TakeProfitSetup<'info> {
    pub fn validate(
        ctx: &Context<TakeProfitSetup>,
        expiration: i64,
        is_bundle: bool,
    ) -> Result<()> {
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
            expiration,
            TakeProfitCleanup::get_hash(),
            is_bundle,
        )?;

        Ok(())
    }

    pub fn take_profit_setup(
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
            self.close_position_setup
                .approve_swap_authority_delegation(
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
