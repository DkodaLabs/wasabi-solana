use {super::DepositOrWithdraw, crate::events::Deposit, anchor_lang::prelude::*};

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct MintArgs {
    pub shares_amount: u64,
}

pub trait MintTrait {
    fn mint(&mut self, args: &MintArgs) -> Result<()>;
}

impl MintTrait for DepositOrWithdraw<'_> {
    fn mint(&mut self, args: &MintArgs) -> Result<()> {
        self.mint_shares_to_user(args.shares_amount)?;
        let shares_supply = self.shares_mint.supply;

        let tokens_in = if shares_supply == 0 {
            args.shares_amount
        } else {
            self.lp_vault
                .total_assets
                .checked_mul(args.shares_amount)
                .expect("overflow")
                .checked_add(shares_supply)
                .expect("overflow")
                .checked_div(shares_supply)
                .expect("overflow")
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
            shares: args.shares_amount,
        });

        Ok(())
    }
}