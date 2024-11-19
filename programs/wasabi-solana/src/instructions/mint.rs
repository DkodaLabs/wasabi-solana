use {
    super::DepositOrWithdraw,
    crate::{error::ErrorCode, events::Deposit},
    anchor_lang::prelude::*,
};

pub trait MintTrait {
    fn mint(&mut self, shares_amount: u64) -> Result<()>;
}

impl MintTrait for DepositOrWithdraw<'_> {
    fn mint(&mut self, shares_amount: u64) -> Result<()> {
        self.mint_shares_to_user(shares_amount)?;
        let shares_amount_u128 = shares_amount as u128;
        let shares_supply_u128 = self.shares_mint.supply as u128;
        let total_assets_u128 = self.lp_vault.total_assets as u128;

        let tokens_in = if shares_supply_u128 == 0 {
            shares_amount
        } else {
            total_assets_u128
                .checked_mul(shares_amount_u128)
                .expect("overflow")
                .checked_add(shares_supply_u128)
                .expect("overflow")
                .checked_div(shares_supply_u128)
                .expect("overflow")
                .try_into()
                .map_err(|_| ErrorCode::U64Overflow)?
        };

        self.transfer_token_from_owner_to_vault(tokens_in)?;

        self.lp_vault.total_assets = self
            .lp_vault
            .total_assets
            .checked_add(tokens_in)
            .expect("overflow");

        emit!(Deposit {
            vault: self.shares_mint.key(),
            sender: self.owner.key(),
            owner: self.owner.key(),
            assets: tokens_in,
            shares: shares_amount,
        });

        Ok(())
    }
}
