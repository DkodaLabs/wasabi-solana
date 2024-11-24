use {
    crate::{
        instructions::close_position_cleanup::*,  utils::get_function_hash,
    },
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface},
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

    pub fn close_short_position_cleanup(&mut self) -> Result<()> {
        self.close_position_cleanup
            .close_position_cleanup(&CloseAction::Market)?;
        Ok(())
    }
}
