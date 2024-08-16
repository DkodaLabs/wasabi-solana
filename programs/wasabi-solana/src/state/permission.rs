use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Copy, PartialEq,)]
#[repr(u8)]
pub enum AuthorityStatus {
    Inactive,
    Active,
}

const INIT_VAULT_PERMISSION: u8 = 0b00000001;
const LIQUIDATE_PERMISSION: u8 = 0b00000010;
const COSIGN_PERMISSION: u8 = 0b00000100;

#[account]
pub struct Permission {
  /// The key that is given these permissions
  pub authority: Pubkey,
  pub status: AuthorityStatus,
  pub is_super_authority: bool,
  pub permissions_map: u8,
}

impl Permission {
  /// True if the authority can grant permissions to other keys
  pub fn can_create_permission(&self) -> bool {
    self.is_super_authority
  }

  /// True if the authority has permission to initialize vaults
  pub fn can_init_vault(&self) -> bool {
    self.permissions_map & INIT_VAULT_PERMISSION == INIT_VAULT_PERMISSION || self.is_super_authority
  }

  /// True if the authority has permission to liquidate positions
  pub fn can_liquidate(&self) -> bool {
    self.permissions_map & LIQUIDATE_PERMISSION == LIQUIDATE_PERMISSION || self.is_super_authority
  }

  /// True if the authority has permission to co-sign OpenPosition and ClosePosition instructions
  pub fn can_cosign(&self) -> bool {
    self.permissions_map & COSIGN_PERMISSION == COSIGN_PERMISSION || self.is_super_authority
  }
}