use {
    crate::error::ErrorCode,
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

pub fn position_setup_transaction_introspecation_validation(
    sysvar_info: &AccountInfo,
    clean_up_ix_hash: [u8; 8],
) -> Result<()> {
    let current_index = sysvar::instructions::load_current_index_checked(sysvar_info)? as usize;

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
                if ixn_unwrapped.data[0..8] == clean_up_ix_hash {
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
    msg!("VALUE: {}", value);
    msg!("VALUE TO COMPARE: {}", value_to_compare);

    let difference = value.abs_diff(value_to_compare);
    msg!("difference: {}", difference);

    let scaled_difference = difference.checked_mul(100).expect("overflow");
    let max_allowed = value.checked_mul(u64::from(percentage)).expect("overflow");
    msg!("max allowed: {}", max_allowed);

    require_gte!(max_allowed, scaled_difference, ErrorCode::ValueDeviatedTooMuch);
    //require!(
    //    difference * 100 <= value.checked_mul(u64::from(percentage)).expect("overflow"),
    //    ErrorCode::ValueDeviatedTooMuch
    //);

    Ok(())
}

