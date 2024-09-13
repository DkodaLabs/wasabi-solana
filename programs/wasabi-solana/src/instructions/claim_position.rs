use anchor_lang::prelude::*;

use crate::Position;

#[derive(Accounts)]
pub struct ClaimPosition<'info> {
    #[account(mut)]
    /// The wallet that owns the Position
    pub trader: Signer<'info>,

    #[account(
      mut,
      close = trader,
      has_one = trader,
    )]
    pub position: Account<'info, Position>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct ClaimPositionArgs {}

pub fn handler(ctx: Context<ClaimPosition>, args: ClaimPositionArgs) -> Result<()> {
    Ok(())
}
