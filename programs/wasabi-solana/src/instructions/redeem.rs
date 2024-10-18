use {
    super::DepositOrWithdraw,
    crate::{error::ErrorCode, events::WithdrawEvent},
    anchor_lang::prelude::*,
};
#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct RedeemArgs {
    pub shares_amount: u64,
}

pub trait Redeem {
    fn redeem(&mut self, args: &RedeemArgs) -> Result<()>;
}

impl Redeem for DepositOrWithdraw<'_> {
    fn redeem(&mut self, args: &RedeemArgs) -> Result<()> {
        let token_transfer_amount = args.shares_amount
            .checked_mul(self.lp_vault.total_assets)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(self.shares_mint.supply)
            .ok_or(ErrorCode::Overflow)?;

        self.transfer_token_from_vault_to_owner(token_transfer_amount)?;
        self.burn_shares_from_user(args.shares_amount)?;

        self.lp_vault
            .total_assets
            .checked_sub(token_transfer_amount)
            .ok_or(ErrorCode::Overflow)?;

        let sender_owner_receiver = self.owner.key();

        // NOTE: Who took what action
        // Having the holistic wallet is better
        emit!(WithdrawEvent {
            sender: sender_owner_receiver, // Sending Ix (but not tokens)
            owner: sender_owner_receiver, // Owner of the token account
            receiver: sender_owner_receiver, // Receiving tokens
            assets: token_transfer_amount,
            shares: args.shares_amount,
        });

        Ok(())
    }
}

//
//pub fn handler(ctx: Context<DepositOrWithdraw>, args: RedeemArgs) -> Result<()> {
//    // Tansfer the tokens to the users
//    let token_transfer_amt = args
//        .shares_amount
//        .checked_mul(ctx.accounts.lp_vault.total_assets)
//        .expect("overflow")
//        .checked_div(ctx.accounts.shares_mint.supply)
//        .expect("overflow");
//    ctx.accounts
//        .transfer_token_from_vault_to_owner(token_transfer_amt)?;
//
//    // Burn the shares
//    ctx.accounts.burn_shares_from_user(args.shares_amount)?;
//
//    // Update the LpVault for total assets withdrawn.
//    let lp_vault = &mut ctx.accounts.lp_vault;
//    lp_vault.total_assets = lp_vault
//        .total_assets
//        .checked_sub(token_transfer_amt)
//        .expect("underflow");
//
//    emit!(Withdraw {
//        sender: ctx.accounts.owner.key(),
//        owner: ctx.accounts.owner.key(),
//        receiver: ctx.accounts.owner.key(),
//        assets: token_transfer_amt,
//        shares: args.shares_amount,
//    });
//
//    Ok(())
//}
