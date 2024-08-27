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
    #[msg("Swap amount limit was exceeded")]
    SwapAmountExceeded, // 6005
    #[msg("Invalid pool")]
    InvalidPool, // 6006
    #[msg("Invalid position")]
    InvalidPosition, // 6007
    #[msg("Invalid swap cosigner")]
    InvalidSwapCosigner, // 6008
}
