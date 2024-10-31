use {super::DepositOrWithdraw, crate::events::Withdraw, anchor_lang::prelude::*};

pub trait WithdrawTrait {
    fn withdraw(&mut self, amount: u64) -> Result<()>;
}

impl WithdrawTrait for DepositOrWithdraw<'_> {
    fn withdraw(&mut self, amount: u64) -> Result<()> {
        self.transfer_token_from_vault_to_owner(amount)?;
        let total_assets = self.lp_vault.total_assets;

        let shares_burn_amount = amount
            .checked_mul(self.shares_mint.supply)
            .expect("overflow")
            .checked_add(total_assets)
            .expect("overflow")
            .checked_div(total_assets)
            .expect("overflow");

        self.burn_shares_from_user(shares_burn_amount)?;

        self.lp_vault.total_assets = self
            .lp_vault
            .total_assets
            .checked_sub(amount)
            .expect("underflow");

        emit!(Withdraw {
            vault: self.lp_vault.shares_mint,
            sender: self.owner.key(),
            owner: self.owner_asset_account.owner.key(),
            receiver: self.owner_asset_account.key(),
            assets: amount,
            shares: shares_burn_amount,
        });

        Ok(())
    }
}
