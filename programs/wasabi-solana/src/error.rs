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
    #[msg("Maximum tokens swapped exceeded")]
    MaxSwapExceeded, // 6009
    #[msg("Owner doesnt match")]
    IncorrectOwner, // 6010
    #[msg("Cannot close bad debt")]
    BadDebt, // 6011
    #[msg("Wrong fee wallet")]
    IncorrectFeeWallet, // 6012
    #[msg("Invalid value")]
    InvalidValue, // 6013
    #[msg("Insufficient available principal")]
    InsufficientAvailablePrincipal, // 6014
    #[msg("Principal too high")]
    PrincipalTooHigh, // 6015
    #[msg("Value deviated too much")]
    ValueDeviatedTooMuch, // 6016
    #[msg("Price target not reached")]
    PriceTargetNotReached, // 6017
    #[msg("Max borrow exceeded")]
    MaxBorrowExceeded, // 6018
    #[msg("Max repay exceeded")]
    MaxRepayExceeded, // 6019
    #[msg("Trading disabled")]
    TradingDisabled, // 6020
    #[msg("LPing disabled")]
    LPingDisabled, // 6021
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow, // 6022
    #[msg("Arithmetic underflow")]
    ArithmeticUnderflow, // 6023
    #[msg("Amount exceeds u64")]
    U64Overflow, // 6024
    #[msg("Division by zero")]
    ZeroDivision, // 6025
}
