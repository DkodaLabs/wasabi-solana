use {
    crate::{error::ErrorCode, LpVault},
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
pub struct Repay<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Mint of the tokens to be transfered - required for `TransferChecked`
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    /// Source of the tokens being repaid
    /// Does this belong to `Signer`? If so, can infer.
    pub source: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    //NOTE: I think this should be the mint of the LP Vault
    #[account(
        mut,
        has_one = vault,
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RepayArgs {
    amount: u64,
}

impl<'info> Repay<'info> {
    pub fn validate(ctx: &Context<Repay>, args: &RepayArgs) -> Result<()> {
        // Prevent over repaying to ensure vault accounting works
        require!(
            args.amount <= ctx.accounts.lp_vault.total_borrowed,
            ErrorCode::MaxRepayExceeded
        );
        Ok(())
    }

    // Change: 20241017 - Change to `TransferChecked`
    fn transfer_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.source.to_account_info(),
            mint: self.mint.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.payer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, self.mint.decimals)
    }

    pub fn repay(&mut self, args: &RepayArgs) -> Result<()> {
        self.transfer_to_vault(args.amount)?;
        self.lp_vault.total_borrowed = self
            .lp_vault
            .total_borrowed
            .checked_sub(args.amount)
            .expect("overflow");

        Ok(())
    }
}

//pub fn handler(ctx: Context<Repay>, args: RepayArgs) -> Result<()> {
//    ctx.accounts.transfer_to_vault(args.amount)?;
//
//    let lp_vault = &mut ctx.accounts.lp_vault;
//    lp_vault.total_borrowed = lp_vault
//        .total_borrowed
//        .checked_sub(args.amount)
//        .expect("overflow");
//    Ok(())
//}
