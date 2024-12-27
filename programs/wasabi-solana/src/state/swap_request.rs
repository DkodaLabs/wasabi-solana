use anchor_lang::prelude::*;

#[derive(AnchorDeserialize, AnchorSerialize, Clone)]
pub struct StakeSwapCache {
    pub src_bal_before: u64,

    pub dst_bal_before: u64,
}

/// An account that is used to cache data between the open position setup and cleanup instructions.
#[account]
pub struct StakeSwapRequest {
    pub max_amount_in: u64,
    pub min_target_amount: u64,
    pub lp_vault_key: Pubkey,
    pub swap_cache: StakeSwapCache,
}
