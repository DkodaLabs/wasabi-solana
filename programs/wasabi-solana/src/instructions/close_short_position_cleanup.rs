use {
    crate::{
        instructions::close_position_cleanup::*, short_pool_signer_seeds, utils::get_function_hash,
    },
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
pub struct CloseShortPositionCleanup<'info> {
    pub close_position_cleanup: ClosePositionCleanup<'info>,

    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = collateral,
        associated_token::authority = owner,
        associated_token::token_program = collateral_token_program,
    )]
    /// Account where user will receive their payout
    pub owner_collateral_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral: InterfaceAccount<'info, Mint>,

    pub collateral_token_program: Interface<'info, TokenInterface>,
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
            mint: self.collateral.to_account_info(),
            to: self.owner_collateral_account.to_account_info(),
            authority: self.close_position_cleanup.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self
                .close_position_cleanup
                .collateral_token_program
                .to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[short_pool_signer_seeds!(self.close_position_cleanup.pool)],
        };
        token_interface::transfer_checked(cpi_ctx, amount, self.collateral.decimals)
    }

    pub fn close_short_position_cleanup(&mut self) -> Result<()> {
        self.close_position_cleanup.close_position_cleanup(false)?;
        Ok(())
    }
}
