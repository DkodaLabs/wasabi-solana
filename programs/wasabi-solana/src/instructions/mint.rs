use {super::DepositOrWithdraw, crate::events::Deposit, anchor_lang::prelude::*};

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct MintArgs {
    pub shares_amount: u64,
}

pub trait Mint {
    fn mint(&mut self, args: &MintArgs) -> Result<()>;
}

impl Mint for DepositOrWithdraw<'_> {
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
            vault: self.lp_vault.key(),
            sender: self.owner.key(),
            owner: self.owner_asset_account.owner.key(),
            assets: tokens_in,
            shares: args.shares_amount,
        });

        Ok(())
    }
}
//
//pub fn handler(ctx: Context<DepositOrWithdraw>, args: MintArgs) -> Result<()> {
//    ctx.accounts.mint_shares_to_user(args.shares_amount)?;
//
//    let shares_supply = ctx.accounts.shares_mint.supply;
//    let total_assets = ctx.accounts.lp_vault.total_assets;
//
//    // conversion rate of shares to tokens = total_assets / shares_supply
//    let tokens_in = if shares_supply == 0 {
//        args.shares_amount
//    } else {
//        (total_assets
//            .checked_mul(args.shares_amount)
//            .expect("overflow")
//            // round up by adding 1 unit of shares_supply
//            .checked_add(shares_supply)
//            .expect("overflow"))
//        .checked_div(shares_supply)
//        .expect("overflow")
//    };
//    ctx.accounts.transfer_token_from_owner_to_vault(tokens_in)?;
//
//    // Update the LpVault for total assets deposited.
//    let lp_vault = &mut ctx.accounts.lp_vault;
//    lp_vault.total_assets = lp_vault
//        .total_assets
//        .checked_add(tokens_in)
//        .expect("overflow");
//
//    emit!(Deposit {
//        sender: ctx.accounts.owner.key(),
//        owner: ctx.accounts.owner.key(),
//        assets: tokens_in,
//        shares: args.shares_amount,
//    });
//
//    Ok(())
//}
