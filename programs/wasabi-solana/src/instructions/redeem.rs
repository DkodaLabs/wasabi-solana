use {
    super::DepositOrWithdraw,
    crate::{error::ErrorCode, events::Withdraw},
    anchor_lang::prelude::*,
};

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct RedeemArgs {
    pub shares_amount: u64,
}

pub trait RedeemTrait {
    fn redeem(&mut self, shares_amount: u64) -> Result<()>;
}

impl RedeemTrait for DepositOrWithdraw<'_> {
    fn redeem(&mut self, shares_amount: u64) -> Result<()> {
        require_gt!(shares_amount, 0, ErrorCode::ZeroAmount);
        let shares_amount_u128 = shares_amount as u128;
        let total_assets_u128 = self.lp_vault.total_assets as u128;
        let shares_supply_u128 = self.shares_mint.supply as u128;

        let token_transfer_amount = shares_amount_u128
            .checked_mul(total_assets_u128)
            .ok_or(ErrorCode::ArithmeticOverflow)?
            .checked_div(shares_supply_u128)
            .ok_or(ErrorCode::ArithmeticOverflow)?
            .try_into()
            .map_err(|_| ErrorCode::U64Overflow)?;

        self.transfer_token_from_vault_to_owner(token_transfer_amount)?;
        self.burn_shares_from_user(shares_amount)?;

        self.lp_vault.total_assets = self
            .lp_vault
            .total_assets
            .checked_sub(token_transfer_amount)
            .ok_or(ErrorCode::ArithmeticUnderflow)?;

        emit!(Withdraw {
            vault: self.shares_mint.key(),
            sender: self.owner.key(),
            owner: self.owner.key(),
            receiver: self.owner_asset_account.key(),
            assets: token_transfer_amount,
            shares: shares_amount,
        });

        Ok(())
    }
}
