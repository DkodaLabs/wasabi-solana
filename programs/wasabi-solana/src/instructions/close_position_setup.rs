use anchor_lang::{prelude::*, solana_program::sysvar};
use anchor_spl::token::{self, Approve, Token, TokenAccount};

use crate::{
    error::ErrorCode, long_pool_signer_seeds, short_pool_signer_seeds,
    utils::position_setup_transaction_introspecation_validation, BasePool, ClosePositionRequest,
    Permission, Position,
};

#[derive(Accounts)]
pub struct ClosePositionSetup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
    /// The account that holds the owner's base currency
    pub owner_currency_account: Account<'info, TokenAccount>,

    #[account(
      mut,
      has_one = collateral_vault
    )]
    pub position: Account<'info, Position>,

    #[account(
      has_one = collateral_vault,
    )]
    /// The LongPool that owns the Position
    pub pool: Account<'info, BasePool>,
    #[account(mut)]
    /// The collateral account that is the source of the swap
    pub collateral_vault: Account<'info, TokenAccount>,

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

impl<'info> ClosePositionSetup<'info> {
    pub fn validate(&self, args: &ClosePositionArgs, cleanup_ix_hash: [u8; 8]) -> Result<()> {
        // Validate pool is correct based on seeds
        let expected_pool_key = if self.pool.is_long_pool {
            Pubkey::create_program_address(long_pool_signer_seeds!(self.pool), &crate::ID)
                .expect("key")
        } else {
            Pubkey::create_program_address(short_pool_signer_seeds!(self.pool), &crate::ID)
                .expect("key")
        };
        require!(expected_pool_key == self.pool.key(), ErrorCode::InvalidPool);

        // Validate TX only has only one setup IX and has one following cleanup IX
        position_setup_transaction_introspecation_validation(&self.sysvar_info, cleanup_ix_hash)?;

        if !self.permission.can_cosign_swaps() {
            return Err(ErrorCode::InvalidSwapCosigner.into());
        }

        require!(
            self.owner.key() == self.position.trader,
            ErrorCode::IncorrectOwner
        );

        let now = Clock::get()?.unix_timestamp;

        if now > args.expiration {
            return Err(ErrorCode::PositionReqExpired.into());
        }

        Ok(())
    }

    pub fn set_close_position_request(&mut self, args: &ClosePositionArgs) -> Result<()> {
        let position = &self.position;
        // Create a close position request
        let close_position_request = &mut self.close_position_request;
        close_position_request.swap_cache.source_bal_before = self.collateral_vault.amount;
        close_position_request.swap_cache.destination_bal_before =
            self.owner_currency_account.amount;
        close_position_request.interest = args.interest;
        close_position_request.max_amount_in = position.collateral_amount;
        close_position_request.min_target_amount = args.min_target_amount;
        close_position_request.pool_key = position.collateral_vault;
        close_position_request.position = position.key();
        Ok(())
    }

    pub fn approve_owner_delegation(
        &self,
        amount: u64,
        pool: AccountInfo<'info>,
        pool_signer_seeds: &[&[&[u8]]],
    ) -> Result<()> {
        let cpi_accounts = Approve {
            to: self.collateral_vault.to_account_info(),
            delegate: self.owner.to_account_info(),
            authority: pool,
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: pool_signer_seeds,
        };
        token::approve(cpi_ctx, amount)
    }
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct ClosePositionArgs {
    /// The minimum amount out required when swapping
    pub min_target_amount: u64,
    /// The timestamp when this close position request expires.
    pub expiration: i64,
    /// The amount of interest the user must pay
    pub interest: u64,
}
