use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Copy, PartialEq)]
#[repr(u8)]
pub enum AuthorityStatus {
    Inactive,
    Active,
}

pub const INIT_VAULT_PERMISSION: u8 = 0b00000001;
pub const LIQUIDATE_PERMISSION: u8 = 0b00000010;
pub const COSIGN_PERMISSION: u8 = 0b00000100;
pub const INIT_POOL_PERMISSION: u8 = 0b00001000;
pub const VAULT_BORROW_PERMISSION: u8 = 0b00010000;
pub const BUNDLE_AUTHORITY: u8 = 0b00100000;

#[account]
pub struct Permission {
    /// The key that is given these permissions
    pub authority: Pubkey,
    pub status: AuthorityStatus,
    pub is_super_authority: bool,
    pub permissions_map: u8,
}

impl Permission {
    /// True if the authority has permission to initialize vaults
    pub fn can_init_vault(&self) -> bool {
        self.permissions_map & INIT_VAULT_PERMISSION == INIT_VAULT_PERMISSION
            || self.is_super_authority
    }

    /// True if the authority has permission to liquidate positions
    pub fn can_liquidate(&self) -> bool {
        self.permissions_map & LIQUIDATE_PERMISSION == LIQUIDATE_PERMISSION
            || self.is_super_authority
    }

    /// True if the authority has permission to co-sign OpenPosition and ClosePosition instructions
    pub fn can_cosign_swaps(&self) -> bool {
        self.permissions_map & COSIGN_PERMISSION == COSIGN_PERMISSION || self.is_super_authority
    }

    pub fn can_init_pool(&self) -> bool {
        self.permissions_map & INIT_POOL_PERMISSION == INIT_POOL_PERMISSION
            || self.is_super_authority
    }

    pub fn can_borrow_from_vaults(&self) -> bool {
        self.permissions_map & VAULT_BORROW_PERMISSION == VAULT_BORROW_PERMISSION
            || self.is_super_authority
    }

    pub fn bundle_authority(&self) -> bool {
        self.permissions_map & BUNDLE_AUTHORITY == BUNDLE_AUTHORITY
    }
}