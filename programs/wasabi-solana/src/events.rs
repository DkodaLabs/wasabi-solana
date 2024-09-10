use anchor_lang::prelude::*;

use crate::LpVault;

#[event]
pub struct Deposit {
    pub sender: Pubkey,
    pub owner: Pubkey,
    pub assets: u64,
    pub shares: u64,
}

#[event]
pub struct Withdraw {
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub owner: Pubkey,
    pub assets: u64,
    pub shares: u64,
}

#[event]
pub struct NewVault {
    pub pool: Pubkey,
    pub asset: Pubkey,
    pub vault: Pubkey,
}
impl NewVault {
    pub fn new(lp_vault: &Account<'_, LpVault>) -> Self {
        Self {
            pool: lp_vault.key(),
            asset: lp_vault.asset,
            vault: lp_vault.vault,
        }
    }
}
