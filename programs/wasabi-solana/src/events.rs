use {
    crate::{close_position_cleanup::CloseAmounts, LpVault, Position},
    anchor_lang::prelude::*,
};

#[event]
pub struct Deposit {
    pub vault: Pubkey,
    pub sender: Pubkey,
    pub owner: Pubkey,
    pub assets: u64,
    pub shares: u64,
}

#[event]
pub struct Withdraw {
    pub vault: Pubkey,
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
            vault: lp_vault.shares_mint,
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

impl PositionOpened {
    pub fn new(position: &Account<'_, Position>) -> Self {
        Self {
            position: position.key(),
            trader: position.trader,
            currency: position.currency,
            collateral_currency: position.collateral,
            down_payment: position.down_payment,
            principal: position.principal,
            collateral_amount: position.collateral_amount,
            fees_to_be_paid: position.fees_to_be_paid,
        }
    }
}

#[event]
pub struct PositionClosed {
    pub position: Pubkey,
    pub trader: Pubkey,
    pub payout: u64,
    pub principal_repaid: u64,
    pub interest_paid: u64,
    pub fee_amount: u64,
}
impl PositionClosed {
    pub fn new(position: &Account<'_, Position>, close_amounts: &CloseAmounts) -> Self {
        Self {
            position: position.key(),
            trader: position.trader,
            payout: close_amounts.payout,
            principal_repaid: close_amounts.principal_repaid,
            interest_paid: close_amounts.interest_paid,
            fee_amount: close_amounts.close_fee,
        }
    }
}

#[event]
pub struct PositionClosedWithOrder {
    pub position: Pubkey,
    pub trader: Pubkey,
    pub order_type: u8,
    pub payout: u64,
    pub principal_repaid: u64,
    pub interest_paid: u64,
    pub fee_amount: u64,
}

#[event]
pub struct PositionLiquidated {
    pub position: Pubkey,
    pub trader: Pubkey,
    pub payout: u64,
    pub principal_repaid: u64,
    pub interest_paid: u64,
    pub fee_amount: u64,
}
impl PositionLiquidated {
    pub fn new(position: &Account<'_, Position>, close_amounts: &CloseAmounts) -> Self {
        Self {
            position: position.key(),
            trader: position.trader,
            payout: close_amounts.payout,
            principal_repaid: close_amounts.principal_repaid,
            interest_paid: close_amounts.interest_paid,
            fee_amount: close_amounts.close_fee,
        }
    }
}

#[event]
pub struct PositionClaimed {
    pub position: Pubkey,
    pub trader: Pubkey,
    pub amount_claimed: u64,
    pub principal_repaid: u64,
    pub interest_paid: u64,
    pub fee_amount: u64,
}

impl PositionClaimed {
    pub fn new(position: &Account<'_, Position>, close_amounts: &CloseAmounts) -> Self {
        Self {
            position: position.key(),
            trader: position.trader,
            amount_claimed: close_amounts.payout,
            principal_repaid: close_amounts.principal_repaid,
            interest_paid: close_amounts.interest_paid,
            fee_amount: close_amounts.close_fee,
        }
    }
}

// One event for a bunch of things. When donating into a vault they use this. Blast for native
//  yeild for ETH and USD (staked and DAI), so they claim that.
#[event]
pub struct NativeYieldClaimed {
    pub source: Pubkey,
    pub vault: Pubkey,
    pub token: Pubkey,
    pub amount: u64,
}
