use {
    crate::{error::ErrorCode, CloseStopLossOrder, CloseTakeProfitOrder},
    anchor_lang::{prelude::*, solana_program::sysvar},
};

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

pub fn get_shares_mint_address(lp_vault: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[lp_vault.as_ref(), mint.as_ref()], &crate::ID).0
}

pub fn setup_transaction_introspection_validation(
    sysvar_info: &AccountInfo,
    clean_up_ix_hash: [u8; 8],
    is_position_setup: bool,
) -> Result<()> {
    let current_index = sysvar::instructions::load_current_index_checked(sysvar_info)? as usize;

    // Validate there are no previous setup instructions
    for ixn_idx in 0..current_index {
        let ixn = sysvar::instructions::load_instruction_at_checked(ixn_idx, sysvar_info)?;

        if crate::ID == ixn.program_id {
            if is_position_setup {
                if check_function_hash(&ixn.data[0..8]) {
                    continue;
                }
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
