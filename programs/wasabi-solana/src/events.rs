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

#[event]
pub struct PositionOpened {
    pub position: Pubkey,
    pub trader: Pubkey,
    pub currency: Pubkey,
    pub collateral_currency: Pubkey,
    pub down_payment: u64,
    pub principal: u64,
    pub collateral_amount: u64,
    pub fees_to_be_paid: u64,
}

#[event]
pub struct PositionClosed {
    pub position: Pubkey,
    pub trader: Pubkey,
    pub payout: u64,
    pub principal_repaid: u64,
    pub interest_paid: u64,
    pub fee_amount: u64
}

#[event]
pub struct PositionClosedWithOrder {
    pub position: Pubkey,
    pub trader: Pubkey,
    pub order_type: u8,
    pub payout: u64,
    pub principal_repaid: u64,
    pub interest_paid: u64,
    pub fee_amount: u64
}

#[event]
pub struct PositionLiquidated{
    pub position: Pubkey,
    pub trader: Pubkey,
    pub payout: u64,
    pub principal_repaid: u64,
    pub interest_paid: u64,
    pub fee_amount: u64,
}

#[event]
pub struct PositionClaimed {
    pub position: Pubkey,
    pub trader: Pubkey,
    pub amount_claimed: u64,
    pub principal_repaid: u64,
    pub interest_paid: u64,
    pub fee_amount: u64
}

pub struct NativeYieldClaimed { 
    pub vault: Pubkey,
    pub token: Pubkey,
    pub amount: u64
}