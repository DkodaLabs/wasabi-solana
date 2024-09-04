use anchor_lang::prelude::*;

use super::SwapCache;

/// An account that is used to cache data between the open position setup and cleanup instructions.
#[account]
pub struct ClosePositionRequest {
    pub swap_cache: SwapCache,
    pub interest: u64,
    pub min_amount_out: u64,
    pub max_amount_in: u64,
    pub pool_key: Pubkey,
    pub position: Pubkey,
}
