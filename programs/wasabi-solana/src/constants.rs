use anchor_lang::prelude::*;
#[constant]
pub const SEED: &str = "anchor";

#[derive(Eq, PartialEq)]
pub enum StakeProvider {
    Jito = 0,
    Marinade = 1
}

//impl StakeProvider {
//    pub fn from_u8(value: u8) -> Result<Self> {
//        match value {
//            0 => Ok(StakeProvider::Jito),
//            1 => Ok(StakeProvider::Marinade),
//            _ => Err(error!(ErrorCode::InvalidStakeProvider)),
//        }
//    }
//
//    pub fn to_u8(&self) -> u8 {
//        match self {
//            StakeProvider::Jito => 0,
//            StakeProvider::Marinade => 1,
//        }
//    }
//}
//
pub const JITO_STAKE_POOL: &str = "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb";
pub const JITO_WITHDRAW_AUTHORITY: &str = "6iQKfEyhr3bZMotVkW6beNZz5CPAkiwvgV2CTje9pVSS";
pub const JITO_RESERVE_STAKE_ACCOUNT: &str = "BgKUXdS29YcHCFrPm5M8oLHiTzZaMDjsebggjoaQ6KFL";
pub const JITO_FEE_ACCOUNT: &str = "feeeFLLsam6xZJFc6UQFrHqkvVt4jfmVvi2BRLkUZ4i";
pub const JITO_POOL_TOKEN_MINT: &str = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";
