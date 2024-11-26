use anchor_lang::prelude::*;

#[account]
pub struct ProtocolWallet {
    pub bump: u8,
    pub nonce: u8,
    pub wallet_type: u8,
}

impl ProtocolWallet {
    pub const FEE: u8 = 0;
    pub const LIQUIDATION: u8 = 1;
}
