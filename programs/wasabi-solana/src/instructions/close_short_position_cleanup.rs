use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer};

use crate::{
    instructions::close_position_cleanup::*, short_pool_signer_seeds, utils::get_function_hash,
};

#[derive(Accounts)]
pub struct CloseShortPositionCleanup<'info> {
    pub close_position_cleanup: ClosePositionCleanup<'info>,

    #[account(mut)]
    /// Account where user will receive their payout
    pub owner_collateral_account: Account<'info, TokenAccount>,
}

impl<'info> CloseShortPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "close_short_position_cleanup")
    }

    pub fn transfer_collateral_back_to_user(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self
                .close_position_cleanup
                .collateral_vault
                .to_account_info(),
            to: self.owner_collateral_account.to_account_info(),
            authority: self.close_position_cleanup.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.close_position_cleanup.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[short_pool_signer_seeds!(self.close_position_cleanup.pool)],
        };
        token::transfer(cpi_ctx, amount)
    }
}

pub fn handler(ctx: Context<CloseShortPositionCleanup>) -> Result<()> {
    // make sure all leftover collateral is sent back to the user
    let close_amounts = crate::instructions::close_position_cleanup::shared_position_cleanup(
        &mut ctx.accounts.close_position_cleanup,
        false,
    )?;

    // Transfer collateral back to user
    ctx.accounts
        .transfer_collateral_back_to_user(close_amounts.payout)?;

    Ok(())
}
