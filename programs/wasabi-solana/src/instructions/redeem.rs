use anchor_lang::prelude::*;

use crate::events::Withdraw;

use super::DepositOrWithdraw;

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct RedeemArgs {
    pub shares_amount: u64,
}

pub fn handler(ctx: Context<DepositOrWithdraw>, args: RedeemArgs) -> Result<()> {
    // Tansfer the tokens to the users
    let token_transfer_amt = args
        .shares_amount
        .checked_mul(ctx.accounts.lp_vault.total_assets)
        .expect("overflow")
        .checked_div(ctx.accounts.shares_mint.supply)
        .expect("overflow");
    ctx.accounts
        .transfer_token_from_vault_to_owner(token_transfer_amt)?;

    // Burn the shares
    ctx.accounts.burn_shares_from_user(args.shares_amount)?;

    // Update the LpVault for total assets withdrawn.
    let lp_vault = &mut ctx.accounts.lp_vault;
    lp_vault.total_assets = lp_vault
        .total_assets
        .checked_sub(token_transfer_amt)
        .expect("underflow");

    emit!(Withdraw {
        sender: ctx.accounts.owner.key(),
        owner: ctx.accounts.owner_shares_account.owner.key(),
        receiver: ctx.accounts.owner_asset_account.owner.key(),
        assets: token_transfer_amt,
        shares: args.shares_amount,
    });

    Ok(())
}
