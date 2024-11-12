use {super::DepositOrWithdraw, crate::events::Withdraw, anchor_lang::prelude::*};

pub trait WithdrawTrait {
    fn withdraw(&mut self, amount: u64) -> Result<()>;
}

impl WithdrawTrait for DepositOrWithdraw<'_> {
    fn withdraw(&mut self, amount: u64) -> Result<()> {
        let amount_u128 = amount as u128;
        let total_assets_u128 = self.lp_vault.total_assets as u128;
        let shares_supply_u128 = self.shares_mint.supply as u128;

        // Calculate proportional rounding protection
        // Uses 0.1% (1/1000) of withdrawal amount as protection, minimum of 1
        let rounding_protection = std::cmp::max(1, amount_u128.checked_div(1000).unwrap_or(1));

        let shares_burn_amount = amount_u128
            .checked_mul(shares_supply_u128)
            .expect("amount * shares supply overflow")
            .checked_add(rounding_protection)
            .expect("numerator addition overflow")
            .checked_div(total_assets_u128)
            .expect("division by zero");

        //let shares_burn_amount = amount_u128
        //    .checked_mul(shares_supply_u128)
        //    .expect("amount * shares supply overflow")
        //    .checked_add(
        //        total_assets_u128
        //            .checked_sub(1)
        //            .expect("total assets underflow"),
        //    )
        //    .expect("numerator addition overflow")
        //    .checked_div(total_assets_u128)
        //    .expect("division by zero");

        let shares_burn_u64 =
            u64::try_from(shares_burn_amount).expect("shares burn amount exceeds u64");

        self.burn_shares_from_user(shares_burn_u64)?;

        self.lp_vault.total_assets = self
            .lp_vault
            .total_assets
            .checked_sub(amount)
            .expect("total assets underflow");

        self.transfer_token_from_vault_to_owner(amount)?;

        emit!(Withdraw {
            vault: self.lp_vault.shares_mint,
            sender: self.owner.key(),
            owner: self.owner_asset_account.owner.key(),
            receiver: self.owner_asset_account.key(),
            assets: amount,
            shares: shares_burn_u64,
        });

        Ok(())
    }
}
