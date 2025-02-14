use crate::error::ErrorCode;
use anchor_lang::prelude::*;

/// The reciprocal is the account that acts as/holds collateral.
/// For positions, this is simply the collateral account of the pool regardless of the trade side
/// For strategies this can be either a token account or a state account (i.e. JitoSOL ATA / Kamino state)
/// For trench.fund this is lp_vault's collateral vault where collateral is the new created token
/// For market deployment this can be any of the wasabi accounts initialized during deployment
///     - Long Pool
///     - Short Pool
///     - Lp Vault
#[account]
pub struct BundleRequest {
    pub authority: Pubkey,  // The account that has authority to create bundles
    pub caller: Pubkey,     // The payer for the bundle
    pub reciprocal: Pubkey, // We only validate this exists - this happens upon network call
    pub num_expected_tx: u8,
    pub num_executed_tx: u8,
}

impl BundleRequest {
    pub fn validate(&mut self) -> Result<()> {
        require_gte!(
            self.num_expected_tx,
            self.num_executed_tx,
            ErrorCode::IncorrectTxCount
        );
        self.num_executed_tx = self
            .num_executed_tx
            .checked_add(1)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        Ok(())
    }
}