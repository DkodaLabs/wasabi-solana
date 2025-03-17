use anchor_lang::prelude::*;

#[derive(AnchorDeserialize, AnchorSerialize, Clone)]
pub struct SwapCache {
    // Maker is the tokens that's sold:
    // principal from opening,
    // collateral for closing
    pub maker_bal_before: u64,

    // Taker is the tokens that's bought:
    // collateral from opening,
    // principal for closing
    pub taker_bal_before: u64,
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

