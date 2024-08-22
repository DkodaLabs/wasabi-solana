use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Unpermitted action by authority")]
    InvalidPermissions, // 6001
    #[msg("Unpermitted instructions in tx")]
    InvalidTransaction, // 6002
}
