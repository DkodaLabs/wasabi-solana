use {
    crate::{
        error::ErrorCode, long_pool_signer_seeds, short_pool_signer_seeds,
        utils::position_setup_transaction_introspecation_validation, BasePool,
        ClosePositionRequest, Permission, Position, SwapCache,
    },
    anchor_lang::{prelude::*, solana_program::sysvar},
    anchor_spl::token_interface::{self, Approve, Mint, TokenAccount, TokenInterface},
};

// Makes a swap using balances in the vault, but settles the payout to user account

#[derive(Accounts)]
pub struct ClosePositionSetup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    /// CHECK: No need
    pub owner: AccountInfo<'info>,

    #[account(
        mut,
        has_one = collateral_vault,
    )]
    pub position: Box<Account<'info, Position>>,

    /// The pool that owns the Position
    #[account(
        has_one = collateral_vault,
        has_one = currency_vault,
    )]
    pub pool: Account<'info, BasePool>,
    #[account(mut)]
    /// The collateral account that is the source of the swap
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The token account that is the destination of the swap
    #[account(mut)]
    pub currency_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
    )]
    pub permission: Account<'info, Permission>,

    #[account(
        init,
        payer = authority,
        seeds = [b"close_pos", owner.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<ClosePositionRequest>(),
    )]
    pub close_position_request: Account<'info, ClosePositionRequest>,

    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
    #[account(
        address = sysvar::instructions::ID
    )]
    /// CHECK: Sysvar instruction check applied
    pub sysvar_info: AccountInfo<'info>,
}

impl<'info> ClosePositionSetup<'info> {
    pub fn validate(&self, expiration: i64, cleanup_ix_hash: [u8; 8]) -> Result<()> {
        // Validate pool is correct based on seeds
        let expected_pool_key = if self.pool.is_long_pool {
            Pubkey::create_program_address(long_pool_signer_seeds!(self.pool), &crate::ID)
                .expect("key")
        } else {
            Pubkey::create_program_address(short_pool_signer_seeds!(self.pool), &crate::ID)
                .expect("key")
        };
        require_keys_eq!(expected_pool_key, self.pool.key(), ErrorCode::InvalidPool);

        // Validate TX only has only one setup IX and has one following cleanup IX
        position_setup_transaction_introspecation_validation(&self.sysvar_info, cleanup_ix_hash)?;

        require_keys_eq!(
            self.owner.key(),
            self.position.trader,
            ErrorCode::IncorrectOwner
        );

        let now = Clock::get()?.unix_timestamp;

        require_gt!(expiration, now, ErrorCode::PositionReqExpired);

        Ok(())
    }

    pub fn set_close_position_request(
        &mut self,
        min_target_amount: u64,
        interest: u64,
        execution_fee: u64,
        expiration: i64,
    ) -> Result<()> {
        // Create a close position request
        self.close_position_request.set_inner(ClosePositionRequest {
            swap_cache: SwapCache {
                source_bal_before: self.collateral_vault.amount,
                destination_bal_before: self.currency_vault.amount,
            },
            interest,
            max_amount_in: self.position.collateral_amount, // Check
            min_target_amount,
            pool_key: self.pool.key(),
            position: self.position.key(),
            execution_fee,
        });

        Ok(())
    }

    /// Approves the SWAP_AUTHORITY key to sign for the swap
    pub fn approve_swap_authority_delegation(
        &self,
        amount: u64,
        pool: AccountInfo<'info>,
        pool_signer_seeds: &[&[&[u8]]],
    ) -> Result<()> {
        let cpi_accounts = Approve {
            to: self.collateral_vault.to_account_info(),
            delegate: self.authority.to_account_info(),
            authority: pool,
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: pool_signer_seeds,
        };
        token_interface::approve(cpi_ctx, amount)
    }
}