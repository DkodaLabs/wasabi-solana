use anchor_lang::prelude::*;

#[derive(AnchorDeserialize, AnchorSerialize, Clone)]
pub struct StrategyCache {
    // on staking:
    // borrowed currency
    // on unstaking:
    // collateral
    pub src_bal_before: u64,

    // on staking:
    // collateral
    // on unstaking:
    // borrowed currency
    pub dst_bal_before: u64,
}

/// An account that is used to cache data between the open position setup and cleanup instructions.
#[account]
pub struct StrategyRequest {
    pub strategy_cache: StrategyCache,
    // the minimum amount of tokens received from staking
    pub min_target_amount: u64,
    // the maximum amount of tokens to be staked
    pub max_amount_in: u64,
    // the lp_vault the borrowed tokens belong to
    pub lp_vault_key: Pubkey,
    pub strategy: Pubkey,
}
