use anchor_lang::{prelude::*, solana_program::sysvar};
use anchor_spl::token::{Token, TokenAccount};

use crate::{error::ErrorCode, LpVault, OpenPositionRequest};

#[derive(Accounts)]
pub struct OpenLongPositionSetup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
    /// The account that holds the owner's base currency
    pub owner_currency_account: Account<'info, TokenAccount>,
    /// The LP Vault that the user will borrow from
    #[account(
      has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,
    /// The LP Vault's token account.
    pub vault: Account<'info, TokenAccount>,

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

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct OpenLongPositionArgs {
    /// The minimum amount required when swapping
    pub min_amount_out: u64,
}

/// This should only be ran on setup
pub fn transaction_introspecation_validation(sysvar_info: &AccountInfo) -> Result<()> {
    let current_index = sysvar::instructions::load_current_index_checked(sysvar_info)? as usize;

    // Validate there are no previous setup instructions
    for ixn_idx in 0..current_index {
        let ixn = sysvar::instructions::load_instruction_at_checked(ixn_idx, sysvar_info)?;
        if crate::ID == ixn.program_id {
            return Err(ErrorCode::InvalidTransaction.into());
        }
    }

    let mut post_current_idx = 1usize;
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
                // TODO: Check that there is a cleanup instruction
            }
            // TODO: Check against whitelisted programs
            post_current_idx = post_current_idx.checked_add(1).expect("overflow");
        }
    }

    Ok(())
}

pub fn handler(ctx: Context<OpenLongPositionSetup>, _args: OpenLongPositionArgs) -> Result<()> {
    transaction_introspecation_validation(&ctx.accounts.sysvar_info)?;
    // TODO: Validate TX only has one setup IX
    // TODO: Validate TX only has one cleanup IX and it comes after this instruction
    // TODO: Valdiate the parameters and accounts
    // TODO: Borrow from the LP Vault
    // TODO: Consolidate the tokens into the user's token account (token transfer)
    Ok(())
}
