use {
    crate::{
        error::ErrorCode,
        state::{BundleRequest, Permission},
        utils::get_function_hash,
    },
    anchor_lang::{prelude::*, solana_program::sysvar},
};

#[derive(Accounts)]
pub struct BundleSetup<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

    #[account(
        init,
        payer = payer,
        seeds = [b"bundle", authority.key().as_ref(), payer.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<BundleRequest>(),
    )]
    pub bundle_request: Account<'info, BundleRequest>,

    pub system_program: Program<'info, System>,

    /// CHECK
    #[account(address = sysvar::instructions::ID)]
    pub sysvar_info: AccountInfo<'info>,
}

impl BundleSetup<'_> {
    fn get_hash() -> [u8; 8] {
        get_function_hash("global", "bundle_setup")
    }

    // Ensure that initialization of the bundle cache is the first instruction
    fn introspection_validation(&self) -> Result<()> {
        let current_idx =
            sysvar::instructions::load_current_index_checked(&self.sysvar_info)? as usize;
        let first_ix = sysvar::instructions::load_instruction_at_checked(0, &self.sysvar_info)?;
        require_eq!(current_idx, 0, ErrorCode::UnpermittedIx);
        require_keys_eq!(first_ix.program_id, crate::ID, ErrorCode::UnpermittedIx);

        let hash = Self::get_hash();
        if first_ix.data[..8] != hash {
            return Err(ErrorCode::UnpermittedIx.into());
        }

        Ok(())
    }

    pub fn validate(&self) -> Result<()> {
        self.introspection_validation()?;
        require!(
            self.permission.bundle_authority(),
            ErrorCode::InvalidBundleAuthority
        );

        Ok(())
    }

    /// Reciprocal refers to the actual account in which collateral is received (the token account)
    /// or to the account in which that state is recorded. We merely validate this account exists.
    /// The instructions the bundle ixs wrap are responsible for validating their inner state changes.
    pub fn bundle_setup(&mut self, reciprocal: &Pubkey, num_expected_tx: u8) -> Result<()> {
        self.validate()?;
        self.bundle_request.set_inner(BundleRequest {
            authority: self.authority.key(),
            reciprocal: *reciprocal,
            caller: self.payer.key(),
            num_expected_tx,
            num_executed_tx: 0u8,
        });

        Ok(())
    }
}
