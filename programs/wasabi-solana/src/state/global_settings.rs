use anchor_lang::prelude::*;

const TRADING_ENABLED: u16 = 0b0000000000000001;
const LPING_ENABLED: u16 = 0b0000000000000010;

#[account]
pub struct GlobalSettings {
    /// Bit mapping of enabled features. Status allow disabling trading, lping, etc.
    pub statuses: u16,
    pub protocol_fee_wallet: Pubkey,
}

impl GlobalSettings {
    /// Returns true if the platform has trading enabled
    pub fn can_trade(&self) -> bool {
        self.statuses & TRADING_ENABLED == TRADING_ENABLED
    }

    /// Returns true if the platform has LPing enabled
    pub fn can_lp(&self) -> bool {
        self.statuses & LPING_ENABLED == LPING_ENABLED
    }
}

