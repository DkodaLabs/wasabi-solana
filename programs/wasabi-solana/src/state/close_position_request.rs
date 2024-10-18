use {super::SwapCache, anchor_lang::prelude::*};

/// An account that is used to cache data between the open position setup and cleanup instructions.
#[account]
pub struct ClosePositionRequest {
    pub swap_cache: SwapCache,
    pub interest: u64,
    pub min_target_amount: u64,
    pub max_amount_in: u64,
    pub pool_key: Pubkey,
    pub position: Pubkey,
    pub execution_fee: u64,
}
