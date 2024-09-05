use anchor_lang::{prelude::*, solana_program::sysvar};
use anchor_spl::token::{self, Approve, Token, TokenAccount};

use crate::{
    error::ErrorCode, long_pool_signer_seeds,
    utils::position_setup_transaction_introspecation_validation, BasePool, ClosePositionRequest,
    Permission, Position,
};

use super::CloseLongPositionCleanup;

#[derive(Accounts)]
pub struct CloseLongPositionSetup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
    /// The account that holds the owner's base currency
    pub owner_currency_account: Account<'info, TokenAccount>,

    #[account(
      has_one = collateral_vault,
      seeds = [b"long_pool", collateral_vault.mint.as_ref(), owner_currency_account.mint.as_ref()],
      bump,
    )]
    /// The LongPool that owns the Position
    pub long_pool: Account<'info, BasePool>,
    #[account(mut)]
    /// The collateral account that is the source of the swap
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(
      mut,
      has_one = collateral_vault,
    )]
    pub position: Account<'info, Position>,

    pub authority: Signer<'info>,

    #[account(
      has_one = authority,
    )]
    pub permission: Account<'info, Permission>,

    #[account(
      init,
      payer = owner,
      seeds = [b"close_pos", owner.key().as_ref()],
      bump,
      space = 8 + std::mem::size_of::<ClosePositionRequest>(),
    )]
    pub close_position_request: Account<'info, ClosePositionRequest>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
    #[account(
      address = sysvar::instructions::ID
    )]
    /// CHECK: Sysvar instruction check applied
    pub sysvar_info: AccountInfo<'info>,
}

impl<'info> CloseLongPositionSetup<'info> {
    pub fn validate(ctx: &Context<Self>, args: &CloseLongPositionArgs) -> Result<()> {
        // Validate TX only has only one setup IX and has one following cleanup IX
        position_setup_transaction_introspecation_validation(
            &ctx.accounts.sysvar_info,
            CloseLongPositionCleanup::get_hash(),
        )?;

        if !ctx.accounts.permission.can_cosign_swaps() {
            return Err(ErrorCode::InvalidSwapCosigner.into());
        }

        require!(
            ctx.accounts.owner.key() == ctx.accounts.position.trader,
            ErrorCode::IncorrectOwner
        );

        let now = Clock::get()?.unix_timestamp;

        if now > args.expiration {
            return Err(ErrorCode::PositionReqExpired.into());
        }

        Ok(())
    }

    pub fn approve_owner_delegation(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Approve {
            to: self.collateral_vault.to_account_info(),
            delegate: self.owner.to_account_info(),
            authority: self.long_pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[long_pool_signer_seeds!(self.long_pool)],
        };
        token::approve(cpi_ctx, amount)
    }
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct CloseLongPositionArgs {
    /// The minimum amount out required when swapping
    pub min_target_amount: u64,
    /// The timestamp when this close position request expires.
    pub expiration: i64,
    /// The amount of interest the user must pay
    pub interest: u64,
}

pub fn handler(ctx: Context<CloseLongPositionSetup>, args: CloseLongPositionArgs) -> Result<()> {
    // The user is long WIF and used SOL as downpayment. When closing the long WIF position we 
    //  need to take all the WIF collateral and sell it for SOL.
    let position = &ctx.accounts.position;
    // allow "owner" to swap on behalf of the collateral vault
    ctx.accounts.approve_owner_delegation(position.collateral_amount)?;
    // TODO: Pull the collateral from the LongPool vault
    // Create a close position request
    let close_position_request = &mut ctx.accounts.close_position_request;
    close_position_request.swap_cache.source_bal_before = ctx.accounts.collateral_vault.amount;
    close_position_request.swap_cache.destination_bal_before = ctx.accounts.owner_currency_account.amount;
    close_position_request.interest = args.interest;
    close_position_request.max_amount_in = position.collateral_amount;
    close_position_request.min_target_amount = args.min_target_amount;
    close_position_request.pool_key = position.collateral_vault;
    close_position_request.position = position.key();
    Ok(())
}
