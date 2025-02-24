use crate::{
    error::ErrorCode,
    instructions::StrategyWithdrawCleanup,
    lp_vault_signer_seeds,
    state::{LpVault, Permission, Strategy, StrategyCache, StrategyRequest},
    utils::{get_function_hash, setup_transaction_introspection_validation},
};
use anchor_lang::{prelude::*, solana_program::sysvar};
use anchor_spl::token_interface::{self, Approve, Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct StrategyWithdrawSetup<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Box<Account<'info, Permission>>,

    #[account(mut, has_one = vault)]
    pub lp_vault: Box<Account<'info, LpVault>>,
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        has_one = collateral,
        has_one = collateral_vault,
        has_one = lp_vault,
        seeds = [
            b"strategy",
            lp_vault.key().as_ref(),
            collateral.key().as_ref(),
        ],
        bump,
    )]
    pub strategy: Account<'info, Strategy>,

    #[account(
        init,
        payer = authority,
        seeds = [b"strategy_request", strategy.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<StrategyRequest>(),
    )]
    pub strategy_request: Account<'info, StrategyRequest>,

    // Should init beforehand - is owned by the `lp_vault` so only the `lp_vault` can sign
    // operations
    #[account(
        mut,
        constraint = collateral_vault.owner == lp_vault.key()
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    /// CHECK: Sysvar instruction check applied
    #[account(address = sysvar::instructions::ID)]
    pub sysvar_info: AccountInfo<'info>,
}

impl<'info> StrategyWithdrawSetup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "strategy_withdraw_setup")
    }

    pub fn validate(ctx: &Context<Self>, amount_in: u64) -> Result<()> {
        require_gt!(amount_in, 0, ErrorCode::ZeroAmount);

        require!(
            ctx.accounts.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions
        );

        setup_transaction_introspection_validation(
            &ctx.accounts.sysvar_info,
            StrategyWithdrawCleanup::get_hash(),
            false,
        )?;

        Ok(())
    }

    fn approve_authority_delegation(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Approve {
            to: self.collateral_vault.to_account_info(),
            delegate: self.authority.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };

        token_interface::approve(cpi_ctx, amount)
    }

    pub fn strategy_withdraw_setup(
        &mut self,
        amount_in: u64,
        min_target_amount: u64,
    ) -> Result<()> {
        self.approve_authority_delegation(amount_in)?;

        self.strategy_request.set_inner(StrategyRequest {
            min_target_amount,
            max_amount_in: amount_in,
            lp_vault_key: self.lp_vault.key(),
            strategy: self.strategy.key(),
            strategy_cache: StrategyCache {
                src_bal_before: self.collateral_vault.amount,
                dst_bal_before: self.vault.amount,
            },
        });

        Ok(())
    }
}
