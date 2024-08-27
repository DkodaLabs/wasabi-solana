use anchor_lang::{prelude::*, solana_program::sysvar};
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{error::ErrorCode, lp_vault_signer_seeds, BasePool, LpVault, OpenPositionRequest};

use super::OpenLongPositionCleanup;

#[derive(Accounts)]
pub struct OpenLongPositionSetup<'info> {
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
    /// The LongPool that owns the Position
    pub long_pool: Account<'info, BasePool>,
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

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    #[account(
      address = sysvar::instructions::ID
    )]
    /// CHECK: Sysvar instruction check applied
    pub sysvar_info: AccountInfo<'info>,
}

impl<'info> OpenLongPositionSetup<'info> {
    pub fn validate(_ctx: &Context<Self>, args: &OpenLongPositionArgs) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        if now > args.expiration {
            return Err(ErrorCode::PositionReqExpired.into());
        }
        // TODO: Valdiate the parameters and accounts
        Ok(())
    }

    pub fn transfer_user_borrow_amount_from_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.owner_currency_account.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };
        token::transfer(cpi_ctx, amount)
    }
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct OpenLongPositionArgs {
    /// The minimum amount out required when swapping
    pub min_target_amount: u64,
    /// The initial down payment amount required to open the position (is in `currency` for long, `collateralCurrency` for short positions)
    pub down_payment: u64,
    /// The total principal amount to be borrowed for the position.
    pub principal: u64,
    /// The address of the currency to be paid for the position.
    pub currency: Pubkey,
    /// The timestamp when this position request expires.
    pub expiration: i64,
}

pub fn get_function_hash(namespace: &str, name: &str) -> [u8; 8] {
    let preimage = format!("{}:{}", namespace, name);
    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(
        &anchor_lang::solana_program::hash::hash(preimage.as_bytes()).to_bytes()[..8],
    );
    sighash
}

/// This should only be ran on setup
pub fn transaction_introspecation_validation(sysvar_info: &AccountInfo) -> Result<()> {
    let current_index = sysvar::instructions::load_current_index_checked(sysvar_info)? as usize;
    let open_long_position_cleanup_hash = OpenLongPositionCleanup::get_hash();

    // Validate there are no previous setup instructions
    for ixn_idx in 0..current_index {
        let ixn = sysvar::instructions::load_instruction_at_checked(ixn_idx, sysvar_info)?;
        if crate::ID == ixn.program_id {
            return Err(ErrorCode::UnpermittedIx.into());
        }
    }

    let mut post_current_idx = 1usize;
    let mut has_cleanup_ix = false;
    // Check that any ixns after are whitelisted programs
    loop {
        let ixn = sysvar::instructions::load_instruction_at_checked(
            current_index + post_current_idx,
            sysvar_info,
        );
        if ixn.is_err() {
            break;
        } else {
            let ixn_unwrapped = ixn.unwrap();
            if crate::ID == ixn_unwrapped.program_id {
                // Check that there is a cleanup instruction
                if ixn_unwrapped.data[0..8] == open_long_position_cleanup_hash {
                    has_cleanup_ix = true;
                }
            }
            // TODO: Check against whitelisted programs
            post_current_idx = post_current_idx.checked_add(1).expect("overflow");
        }
    }
    if !has_cleanup_ix {
        return Err(ErrorCode::MissingCleanup.into());
    }

    Ok(())
}

pub fn handler(ctx: Context<OpenLongPositionSetup>, args: OpenLongPositionArgs) -> Result<()> {
    // Validate TX only has only one setup IX and has one following cleanup IX
    transaction_introspecation_validation(&ctx.accounts.sysvar_info)?;

    // Borrow from LP Vault
    ctx.accounts
        .transfer_user_borrow_amount_from_vault(args.principal)?;

    ctx.accounts.owner_currency_account.reload()?;

    // Cache data on the `open_position_request` account. We use the value
    // after the borrow in order to track the entire amount being swapped.
    let open_position_request = &mut ctx.accounts.open_position_request;
    open_position_request.min_amount_out = args.min_target_amount;
    open_position_request.max_amount_in = args
        .down_payment
        .checked_add(args.principal)
        .expect("overflow");
    open_position_request.swap_cache.source_bal_before = ctx.accounts.owner_currency_account.amount;
    open_position_request.swap_cache.destination_bal_before = ctx.accounts.collateral_vault.amount;

    Ok(())
}
