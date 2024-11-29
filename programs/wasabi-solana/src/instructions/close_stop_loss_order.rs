use {
    crate::{
        error::ErrorCode, events::ExitOrderCancelled, state::Permission, utils::get_function_hash,
        Position, StopLossOrder,
    },
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct CloseStopLossOrder<'info> {
    #[account(mut)]
    pub closer: Signer<'info>,
    ///CHECK:
    #[account(mut)]
    pub trader: AccountInfo<'info>,

    pub permission: Account<'info, Permission>,

    #[account(
        has_one = trader,
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        close = trader,
        seeds = [b"stop_loss_order", position.key().as_ref()],
        bump,
    )]
    pub stop_loss_order: Account<'info, StopLossOrder>,
}

impl<'info> CloseStopLossOrder<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "close_stop_loss_order")
    }

    fn validate(&self) -> Result<()> {
        if self.trader.key() != self.closer.key() {
            require_keys_eq!(
                self.closer.key(),
                self.permission.authority,
                ErrorCode::InvalidPermissions
            );

            require!(
                self.permission.can_liquidate(),
                ErrorCode::InvalidPermissions
            );
        } else {
            require_keys_eq!(
                self.trader.key(),
                self.closer.key(),
                ErrorCode::InvalidPermissions
            );
        }

        Ok(())
    }

    pub fn close_stop_loss_order(&self) -> Result<()> {
        self.validate()?;

        emit!(ExitOrderCancelled {
            order_type: 1,
            position_id: self.position.key(),
        });

        Ok(())
    }
}
