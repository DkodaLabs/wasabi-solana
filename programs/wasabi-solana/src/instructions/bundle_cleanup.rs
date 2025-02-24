use {
    crate::{
        constants::JITO_TIP_ACCOUNTS,
        error::ErrorCode,
        state::{BundleRequest, Permission},
        utils::get_function_hash,
    },
    anchor_lang::{
        prelude::*,
        solana_program::{program::invoke, system_instruction::transfer, sysvar},
    },
};

#[derive(Accounts)]
pub struct BundleCleanup<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

    #[account(
        mut,
        seeds = [b"bundle", authority.key().as_ref(), payer.key().as_ref()],
        has_one = reciprocal,
        has_one = authority,
        bump,
    )]
    pub bundle_request: Account<'info, BundleRequest>,

    /// CHECK: done by bundle request
    pub reciprocal: AccountInfo<'info>,

    /// CHECK
    #[account(mut)]
    pub tip_account: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK
    #[account(address = sysvar::instructions::ID)]
    pub sysvar_info: AccountInfo<'info>,
}

impl BundleCleanup<'_> {
    fn get_hash() -> [u8; 8] {
        get_function_hash("global", "close_bundle_cache")
    }

    // Ensure this instruction is the last instruction in the transaction
    // The instruction immediately preceding this instruction should also be a cleanup
    // instruction issued by our program - i.e. we whitelist the instructions that should
    // be at index current - 1.
    fn introspection_validation(&self) -> Result<()> {
        let current_idx =
            sysvar::instructions::load_current_index_checked(&self.sysvar_info)? as usize;
        let mut post_current_idx = 1usize;
        #[allow(unused_assignments)]
        let mut end_idx = 0usize;
        loop {
            let ix = sysvar::instructions::load_instruction_at_checked(
                current_idx + post_current_idx,
                &self.sysvar_info,
            );
            if ix.is_err() {
                end_idx = current_idx
                    .checked_sub(1)
                    .ok_or(ErrorCode::ArithmeticUnderflow)?;
                break;
            }
            post_current_idx = post_current_idx
                .checked_add(1)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        }

        let end_ix = sysvar::instructions::load_instruction_at_checked(end_idx, &self.sysvar_info)?;
        require_keys_eq!(crate::ID, end_ix.program_id, ErrorCode::UnpermittedIx);

        let hash = Self::get_hash();
        if hash != end_ix.data[0..8] {
            return Err(ErrorCode::UnpermittedIx.into());
        }

        Ok(())
    }

    fn validate_tip_account(&self) -> Result<()> {
        if JITO_TIP_ACCOUNTS.contains(&self.tip_account.key().to_string().as_str()) {
            Ok(())
        } else {
            Err(ErrorCode::InvalidTipAccount.into())
        }
    }

    fn validate(&mut self) -> Result<()> {
        self.bundle_request.validate()?;
        self.validate_tip_account()?;
        self.introspection_validation()?;
        require_eq!(
            self.bundle_request.num_expected_tx,
            self.bundle_request.num_executed_tx,
            ErrorCode::IncorrectTxCount
        );
        require!(
            self.permission.bundle_authority(),
            ErrorCode::InvalidBundleAuthority
        );
        Ok(())
    }

    fn send_tip(&mut self, tip_amount: u64) -> Result<()> {
        let ix = transfer(&self.payer.key(), &self.tip_account.key(), tip_amount);
        Ok(invoke(&ix, &[self.payer.to_account_info()])?)
    }

    pub fn bundle_cleanup(&mut self, tip_amount: u64) -> Result<()> {
        self.validate()?;
        // Call .close() ourselves to ensure ix order
        self.bundle_request.close(self.payer.to_account_info())?;
        self.send_tip(tip_amount)?;
        Ok(())
    }
}
