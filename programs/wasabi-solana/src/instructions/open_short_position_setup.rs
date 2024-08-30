use anchor_lang::{prelude::*, solana_program::sysvar};
use anchor_spl::token::{Token, TokenAccount};

use crate::{
    error::ErrorCode, utils::position_setup_transaction_introspecation_validation, BasePool,
    LpVault, OpenPositionRequest, Permission, Position,
};

use super::OpenShortPositionCleanup;

#[derive(Accounts)]
#[instruction(args: OpenShortPositionArgs)]
pub struct OpenShortPositionSetup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
    #[account(mut)]
    /// The account that holds the owner's base currency
    pub owner_currency_account: Account<'info, TokenAccount>,
    /// The LP Vault that the user will borrow from
    #[account(
      has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,
    #[account(mut)]
    /// The LP Vault's token account.
    pub vault: Account<'info, TokenAccount>,

    #[account(
      has_one = collateral_vault,
  )]
    /// The ShortPool that owns the Position
    pub short_pool: Account<'info, BasePool>,
    /// The collateral account that is the destination of the swap
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(
      init,
      payer = owner,
      seeds = [b"open_pos", owner.key().as_ref()],
      bump,
      space = 8 + std::mem::size_of::<OpenPositionRequest>(),
    )]
    pub open_position_request: Account<'info, OpenPositionRequest>,

    #[account(
      init,
      payer = owner,
      seeds = [b"position", owner.key().as_ref(), short_pool.key().as_ref(), lp_vault.key().as_ref(), &args.nonce.to_le_bytes()],
      bump,
      space = 8 + std::mem::size_of::<Position>(),
    )]
    pub position: Account<'info, Position>,

    pub authority: Signer<'info>,

    #[account(
      has_one = authority,
    )]
    pub permission: Account<'info, Permission>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    #[account(
      address = sysvar::instructions::ID
    )]
    /// CHECK: Sysvar instruction check applied
    pub sysvar_info: AccountInfo<'info>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct OpenShortPositionArgs {
    /// The nonce of the Position
    pub nonce: u16,
    /// The initial down payment amount required to open the position (is in `currency` for long, `collateralCurrency` for short positions)
    pub down_payment: u64,
    /// The total principal amount to be borrowed for the position.
    pub principal: u64,
    /// The address of the currency to be borrowed and sold for the position.
    pub currency: Pubkey,
    /// The timestamp when this position request expires.
    pub expiration: i64,
}

impl<'info> OpenShortPositionSetup<'info> {
    pub fn validate(ctx: &Context<Self>, _args: &OpenShortPositionArgs) -> Result<()> {
        if !ctx.accounts.permission.can_cosign_swaps() {
            return Err(ErrorCode::InvalidSwapCosigner.into());
        }

        // Validate TX only has only one setup IX and has one following cleanup IX
        position_setup_transaction_introspecation_validation(
            &ctx.accounts.sysvar_info,
            OpenShortPositionCleanup::get_hash(),
        )?;

        Ok(())
    }
}

pub fn handler(ctx: Context<OpenShortPositionSetup>, args: OpenShortPositionArgs) -> Result<()> {
    // Cache data on the `open_position_request` account. We use the value
    // after the borrow in order to track the entire amount being swapped.
    let open_position_request = &mut ctx.accounts.open_position_request;

    open_position_request.position = ctx.accounts.position.key();
    open_position_request.pool_key = ctx.accounts.short_pool.key();

    Ok(())
}
