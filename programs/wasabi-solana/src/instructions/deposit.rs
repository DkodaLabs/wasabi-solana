use {
    crate::{
        error::ErrorCode, events::Deposit, lp_vault_signer_seeds, state::GlobalSettings, LpVault,
    },
    anchor_lang::prelude::*,
    anchor_spl::{
        token_2022::Token2022,
        token_interface::{
            self, Burn, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked,
        },
    },
};

#[event_cpi]
#[derive(Accounts)]
pub struct DepositOrWithdraw<'info> {
    /// The key of the user that owns the assets
    pub owner: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = owner,
        associated_token::token_program = asset_token_program,
    )]
    /// The Owner's token account that holds the assets
    pub owner_asset_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = shares_mint,
        associated_token::authority = owner,
        associated_token::token_program = shares_token_program,
    )]
    /// The Owner's token account that stores share tokens
    pub owner_shares_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        has_one = vault,
        has_one = shares_mint,
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,

    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub asset_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub shares_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        seeds = [b"global_settings"],
        bump,
    )]
    pub global_settings: Account<'info, GlobalSettings>,

    pub asset_token_program: Interface<'info, TokenInterface>,
    pub shares_token_program: Program<'info, Token2022>,
}

impl<'info> DepositOrWithdraw<'info> {
    pub fn validate(ctx: &Context<DepositOrWithdraw>) -> Result<()> {
        require!(ctx.accounts.global_settings.can_lp(), ErrorCode::UnpermittedIx);

        Ok(())
    }

    pub(crate) fn transfer_token_from_owner_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.owner_asset_account.to_account_info(),
            mint: self.asset_mint.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.asset_token_program.to_account_info(), cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, self.asset_mint.decimals)
    }

    pub(crate) fn mint_shares_to_user(&self, amount: u64) -> Result<()> {
        let cpi_accounts = MintTo {
            mint: self.shares_mint.to_account_info(),
            to: self.owner_shares_account.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.shares_token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };
        token_interface::mint_to(cpi_ctx, amount)
    }

    pub(crate) fn burn_shares_from_user(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Burn {
            mint: self.shares_mint.to_account_info(),
            from: self.owner_shares_account.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.shares_token_program.to_account_info(), cpi_accounts);
        token_interface::burn(cpi_ctx, amount)
    }

    pub(crate) fn transfer_token_from_vault_to_owner(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.asset_mint.to_account_info(),
            to: self.owner_asset_account.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.asset_token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };
        token_interface::transfer_checked(cpi_ctx, amount, self.asset_mint.decimals)
    }

    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        self.transfer_token_from_owner_to_vault(amount)?;

        let shares_supply = self.shares_mint.supply;
        let shares_to_mint = if shares_supply == 0 {
            amount
        } else {
            shares_supply
                .checked_mul(amount)
                .expect("overflow")
                .checked_div(self.lp_vault.total_assets)
                .expect("overflow")
        };

        self.mint_shares_to_user(shares_to_mint)?;

        self.lp_vault.total_assets = self
            .lp_vault
            .total_assets
            .checked_add(amount)
            .expect("overflow");

        emit!(Deposit {
            vault: self.lp_vault.shares_mint,
            sender: self.owner.key(),
            owner: self.owner.key(),
            assets: amount,
            shares: shares_to_mint,
        });

        Ok(())
    }
}
