use anchor_spl::token::Token;
use {
    crate::{error::ErrorCode, CloseStopLossOrder, CloseTakeProfitOrder, BasePool, LpVault},
    anchor_lang::{prelude::*, solana_program::sysvar},
    anchor_spl::{
        token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked, Approve},
    }
};
use crate::{long_pool_signer_seeds, lp_vault_signer_seeds, short_pool_signer_seeds};

pub fn get_function_hash(namespace: &str, name: &str) -> [u8; 8] {
    let preimage = format!("{}:{}", namespace, name);
    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(
        &anchor_lang::solana_program::hash::hash(preimage.as_bytes()).to_bytes()[..8],
    );
    sighash
}

fn check_function_hash(hash: &[u8]) -> bool {
    match hash {
        x if x == &CloseStopLossOrder::get_hash()[..] => true,
        x if x == &CloseTakeProfitOrder::get_hash()[..] => true,
        _ => false,
    }
}

pub fn position_setup_transaction_introspection_validation(
    sysvar_info: &AccountInfo,
    clean_up_ix_hash: [u8; 8],
) -> Result<()> {
    let current_index = sysvar::instructions::load_current_index_checked(sysvar_info)? as usize;

    // Validate there are no previous setup instructions
    for ixn_idx in 0..current_index {
        let ixn = sysvar::instructions::load_instruction_at_checked(ixn_idx, sysvar_info)?;

        if crate::ID == ixn.program_id {
            if check_function_hash(&ixn.data[0..8]) {
                continue;
            }
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
                if ixn_unwrapped.data[0..8] == clean_up_ix_hash {
                    has_cleanup_ix = true;
                }
            }
            // TODO: Check against whitelisted programs
            post_current_idx = post_current_idx
                .checked_add(1)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        }
    }

    if !has_cleanup_ix {
        return Err(ErrorCode::MissingCleanup.into());
    }

    Ok(())
}

pub fn deduct(amount: u64, deducted_amount: u64) -> (u64, u64) {
    if amount > deducted_amount {
        let remaining = amount - deducted_amount;
        let deducted = deducted_amount;
        (remaining, deducted)
    } else {
        let remaining = 0;
        let deducted = amount;
        (remaining, deducted)
    }
}

/// Check if amount is within % range. `percentage` must be whole number, i.e. 3 == 3%
pub fn validate_difference(value: u64, value_to_compare: u64, percentage: u8) -> Result<()> {
    let difference = value.abs_diff(value_to_compare);

    let scaled_difference = difference
        .checked_mul(100)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let max_allowed = value
        .checked_mul(u64::from(percentage))
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    require_gte!(
        max_allowed,
        scaled_difference,
        ErrorCode::ValueDeviatedTooMuch
    );

    Ok(())
}

pub(crate) fn approve_authority_delegation(
    vault: &TokenAccount,
    authority: &Signer,
    pool: &BasePool,
    token_program: &Interface<TokenInterface>,
    is_long: bool,
    amount: u64
) -> Result<()> {
    let cpi_accounts = Approve {
        to: vault.to_account_info(),
        delegate: authority.to_account_info(),
        authority: pool.to_account_info(),
   };

    let cpi_ctx = CpiContext {
        program: token_program.to_account_info(),
        accounts: cpi_accounts,
        remaining_accounts: Vec::new(),
        signer_seeds: if is_long {
            &[long_pool_signer_seeds!(pool)]
        } else {
            &[short_pool_signer_seeds!(pool)]
        }
    };

    token_interface::approve(cpi_ctx, amount)
}

pub(crate) fn transfer_borrow_amount_from_vault(
    vault: &TokenAccount,
    asset: &Mint,
    asset_vault: &TokenAccount,
    authority: &LpVault,
    token_program: &TokenInterface,
    amount: u64,
) -> Result<()> {
    let cpi_accounts = TransferChecked {
        from: vault.to_account_info(),
        mint: asset.to_account_info(),
        to: asset_vault.to_account_info(),
        authority: authority.to_account_info(),
    };

    let cpi_ctx = CpiContext {
        program: token_program.to_account_info(),
        accounts: cpi_accounts,
        remaining_accounts: Vec::new(),
        signer_seeds: &[lp_vault_signer_seeds!(authority)]
    };

    token_interface::transfer_checked(cpi_ctx, amount, asset.decimals)
}

pub(crate) fn calculate_shares_to_burn(
    src: &LpVault,
    shares_mint: &Mint,
    amount: u64
) -> Result<u64> {
    let amount_u128 = amount as u128;
    let total_assets_u128 = src.total_assets as u128;
    let shares_supply_u128 = shares_mint.supply as u128;

    // Calculate proportional rounding protection
    // Uses 0.1% (1/1000) of withdrawal amount as protection, minimum of 1
    let rounding_protection = std::cmp::max(1, amount_u128.checked_div(1000).unwrap_or(1));

    let shares_burn_amount = amount_u128
        .checked_mul(shares_supply_u128)
        .ok_or(ErrorCode::ArithmeticOverflow)?
        .checked_add(rounding_protection)
        .ok_or(ErrorCode::ArithmeticOverflow)?
        .checked_div(total_assets_u128)
        .ok_or(ErrorCode::ZeroDivision)?;

    let shares_to_burn_u64 =
        u64::try_from(shares_burn_amount).map_err(|_| ErrorCode::U64Overflow)?;

    Ok(shares_to_burn_u64)
}