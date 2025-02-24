use crate::{
    error::ErrorCode,
    state::{BundleRequest, Permission},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ValidateBundle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

    #[account(
        mut,
        has_one = authority,
        seeds = [b"bundle", authority.key().as_ref(), payer.key().as_ref()],
        bump,
    )]
    pub bundle_request: Account<'info, BundleRequest>,
}

impl ValidateBundle<'_> {
    pub fn validate_bundle(&mut self) -> Result<()> {
        require!(
            self.permission.bundle_authority(),
            ErrorCode::InvalidBundleAuthority
        );

        self.bundle_request.validate()
    }
}
