use anchor_lang::prelude::*;

use crate::events::Withdraw;

use super::DepositOrWithdraw;

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct WithdrawArgs {
    pub amount: u64,
}

pub fn handler(ctx: Context<DepositOrWithdraw>, args: WithdrawArgs) -> Result<()> {
    // Tansfer the tokens to the users
    ctx.accounts
        .transfer_token_from_vault_to_owner(args.amount)?;

    let total_assets = ctx.accounts.lp_vault.total_assets;
    let shares_supply = ctx.accounts.shares_mint.supply;

    let shares_burn_amount = args
        .amount
        .checked_mul(shares_supply)
        .expect("overflow")
        .checked_add(total_assets)
        .expect("overflow")
        .checked_div(total_assets)
        .expect("overflow");

    // Burn the shares
    ctx.accounts.burn_shares_from_user(shares_burn_amount)?;

    // Update the LpVault for total assets withdrawn.
    let lp_vault = &mut ctx.accounts.lp_vault;
    lp_vault.total_assets = lp_vault
        .total_assets
        .checked_sub(args.amount)
        .expect("underflow");

    emit!(Withdraw {
        sender: ctx.accounts.owner.key(),
        owner: ctx.accounts.owner_shares_account.owner.key(),
        receiver: ctx.accounts.owner_asset_account.owner.key(),
        assets: args.amount,
        shares: shares_burn_amount,
    });

    Ok(())
}
