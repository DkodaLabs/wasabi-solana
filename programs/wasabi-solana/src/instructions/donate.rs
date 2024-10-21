use {
    crate::{events::NativeYieldClaimed, LpVault},
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
pub struct Donate<'info> {
    /// The key of the address donating
    pub owner: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = currency,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    /// The Payer's token account that holds the assets
    pub owner_asset_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = lp_vault.asset == currency.key(),
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,

    #[account(
        mut,
        associated_token::mint = currency,
        associated_token::authority = lp_vault,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct DonateArgs {
    pub amount: u64,
}

impl<'info> Donate<'info> {
    fn transfer_token_from_owner_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.owner_asset_account.to_account_info(),
            mint: self.currency.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
    }

    pub fn donate(&mut self, args: &DonateArgs) -> Result<()> {
        self.transfer_token_from_owner_to_vault(args.amount)?;
        self.lp_vault.total_assets = self
            .lp_vault
            .total_assets
            .checked_add(args.amount)
            .expect("overflow");

        emit!(NativeYieldClaimed {
            source: self.owner.key(),
            vault: self.vault.key(),
            token: self.lp_vault.asset,
            amount: args.amount,
        });

        Ok(())
    }
}

//pub fn handler(ctx: Context<Donate>, args: DonateArgs) -> Result<()> {
//    // Transfer tokens from payer to vault
//    ctx.accounts
//        .transfer_token_from_owner_to_vault(args.amount)?;
//
//    // Update the LpVault for total assets deposited.
//    let lp_vault = &mut ctx.accounts.lp_vault;
//    lp_vault.total_assets = lp_vault
//        .total_assets
//        .checked_add(args.amount)
//        .expect("overflow");
//
//    emit!(NativeYieldClaimed {
//        source: ctx.accounts.owner.key(),
//        vault: ctx.accounts.vault.key(),
//        token: ctx.accounts.lp_vault.asset,
//        amount: args.amount,
//    });
//
//    Ok(())
//}
