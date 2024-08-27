use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Unpermitted action by authority")]
    InvalidPermissions, // 6000
    #[msg("Unpermitted instructions in tx")]
    UnpermittedIx, // 6001
    #[msg("Missing cleanup ix")]
    MissingCleanup, // 6002
    #[msg("Expired")]
    PositionReqExpired, // 6003
    #[msg("Minimum tokens not met")]
    MinTokensNotMet, // 6004
}
