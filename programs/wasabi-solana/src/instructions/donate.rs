use {
    crate::{
        error::ErrorCode,
        events::NativeYieldClaimed,
        state::{GlobalSettings, Permission},
        LpVault,
    },
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
        has_one = vault,
        constraint = lp_vault.asset == currency.key(),
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,

    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency: InterfaceAccount<'info, Mint>,

    pub permission: Account<'info, Permission>,

    #[account(
        seeds = [b"global_settings"],
        bump,
    )]
    pub global_settings: Account<'info, GlobalSettings>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> Donate<'info> {
    pub fn validate(ctx: &Context<Donate>, amount: u64) -> Result<()> {
        require_gt!(amount, 0, ErrorCode::ZeroAmount);
        require!(
            ctx.accounts.global_settings.can_lp(),
            ErrorCode::UnpermittedIx
        );

        require_keys_eq!(
            ctx.accounts.owner.key(),
            ctx.accounts.permission.authority,
            ErrorCode::InvalidPermissions
        );

        Ok(())
    }

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

    pub fn donate(&mut self, amount: u64) -> Result<()> {
        self.transfer_token_from_owner_to_vault(amount)?;
        self.lp_vault.total_assets = self
            .lp_vault
            .total_assets
            .checked_add(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        emit!(NativeYieldClaimed {
            source: self.owner.key(),
            vault: self.lp_vault.shares_mint,
            token: self.lp_vault.asset,
            amount,
        });

        Ok(())
    }
}
