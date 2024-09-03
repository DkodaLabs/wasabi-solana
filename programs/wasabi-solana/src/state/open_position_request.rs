use anchor_lang::prelude::*;

#[derive(AnchorDeserialize, AnchorSerialize, Clone)]
pub struct SwapCache {
    pub source_bal_before: u64,
    pub destination_bal_before: u64,
}

/// An account that is used to cache data between the open position setup and cleanup instructions.
#[account]
pub struct OpenPositionRequest {
    pub swap_cache: SwapCache,
    pub min_target_amount: u64,
    pub max_amount_in: u64,
    pub pool_key: Pubkey,
    pub position: Pubkey,
}
