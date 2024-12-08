use {
    super::DepositOrWithdraw,
    crate::{error::ErrorCode, events::Withdraw, utils::calculate_shares_to_burn},
    anchor_lang::prelude::*,
};

pub trait WithdrawTrait {
    fn withdraw(&mut self, amount: u64) -> Result<()>;
}

impl WithdrawTrait for DepositOrWithdraw<'_> {
    fn withdraw(&mut self, amount: u64) -> Result<()> {
       let shares_to_burn = calculate_shares_to_burn(
           &self.lp_vault,
           &self.shares_mint,
           amount,
       )?;

        self.burn_shares_from_user(shares_to_burn)?;

        self.lp_vault.total_assets = self
            .lp_vault
            .total_assets
            .checked_sub(amount)
            .ok_or(ErrorCode::ArithmeticUnderflow)?;

        self.transfer_token_from_vault_to_owner(amount)?;

        emit!(Withdraw {
            vault: self.lp_vault.shares_mint,
            sender: self.owner.key(),
            owner: self.owner_asset_account.owner.key(),
            receiver: self.owner_asset_account.key(),
            assets: amount,
            shares: shares_to_burn,
        });

        Ok(())
    }
}
