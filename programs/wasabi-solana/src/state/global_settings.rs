use anchor_lang::prelude::*;

const TRADING_ENABLED: u16 = 0b0000000000000001;
const LPING_ENABLED: u16 = 0b0000000000000010;

#[account]
pub struct GlobalSettings {
    pub super_admin: Pubkey,
    pub fee_wallet: Pubkey,
    pub liquidation_wallet: Pubkey,
    /// Bit mapping of enabled features. Status allow disabling trading, lping, etc.
    pub statuses: u16,
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

    /// Enable trading
    pub fn enable_trading(&mut self) {
        self.statuses |= TRADING_ENABLED;
    }

    /// Disable trading
    pub fn disable_trading(&mut self) {
        self.statuses &= !TRADING_ENABLED;
    }

    /// Enable LPing
    pub fn enable_lping(&mut self) {
        self.statuses |= LPING_ENABLED;
    }

    /// Disable LPing
    pub fn disable_lping(&mut self) {
        self.statuses &= !LPING_ENABLED;
    }

    /// Enable multiple features at once using a bitmask
    pub fn enable_features(&mut self, features: u16) {
        self.statuses |= features;
    }

    /// Disable multiple features at once using a bitmask
    pub fn disable_features(&mut self, features: u16) {
        self.statuses &= !features;
    }

    /// Get the current status of all features
    pub fn get_statuses(&self) -> u16 {
        self.statuses
    }
}
