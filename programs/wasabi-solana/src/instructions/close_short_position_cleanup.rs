use {
    crate::{
        instructions::close_position_cleanup::*, short_pool_signer_seeds, utils::get_function_hash,
    },
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{self, TokenAccount, TransferChecked, Mint},
};

#[derive(Accounts)]
pub struct CloseShortPositionCleanup<'info> {
    pub close_position_cleanup: ClosePositionCleanup<'info>,

    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,

    #[account(mut)]
    /// Account where user will receive their payout
    pub owner_collateral_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,
}

impl<'info> CloseShortPositionCleanup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "close_short_position_cleanup")
    }

    pub fn transfer_collateral_back_to_user(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self
                .close_position_cleanup
                .collateral_vault
                .to_account_info(),
            mint: self.collateral_mint.to_account_info(),
            to: self.owner_collateral_account.to_account_info(),
            authority: self.close_position_cleanup.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.close_position_cleanup.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[short_pool_signer_seeds!(self.close_position_cleanup.pool)],
        };
        token_interface::transfer_checked(cpi_ctx, amount, self.collateral_mint.decimals)
    }

    pub fn close_short_position_cleanup(&mut self) -> Result<()> {
        self.close_position_cleanup.close_position_cleanup(false);
        Ok(())
    }
}

//pub fn handler(ctx: Context<CloseShortPositionCleanup>) -> Result<()> {
//    crate::instructions::close_position_cleanup::shared_position_cleanup(
//        &mut ctx.accounts.close_position_cleanup,
//        false,
//    )?;
//    Ok(())
//}
