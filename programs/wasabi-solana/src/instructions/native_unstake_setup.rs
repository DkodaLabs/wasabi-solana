use crate::{
    lp_vault_signer_seeds,
    error::ErrorCode,
    instructions::NativeUnstakeCleanup,
    state::{Permission, LpVault, StakeRequest, StakeCache, NativeYield},
    utils::{setup_transaction_introspection_validation, get_function_hash}
};

use anchor_lang::{
    prelude::*,
    solana_program::sysvar,
};
use anchor_spl::token_interface::{self, TokenAccount, TokenInterface, Approve};

#[derive(Accounts)]
pub struct NativeUnstakeSetup<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Box<Account<'info, Permission>>,

    #[account(mut, has_one = vault)]
    pub lp_vault: Box<Account<'info, LpVault>>,
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut, 
        has_one = collateral,
        has_one = collateral_vault,
        has_one = lp_vault,
        seeds = [
            b"native_yield",
            lp_vault.key().as_ref(),
            collateral.key().as_ref(),
        ],
        bump,
    )]
    pub native_yield: Account<'info, NativeYield>,
    // Should init beforehand - is owned by the `lp_vault` so only the `lp_vault` can sign
    // operations
    #[account(
        mut, 
        constraint = collateral_vault.owner == lp_vault.key()
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = authority,
        seeds = [b"stake_req", native_yield.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<StakeRequest>(),
    )]
    pub stake_request: Account<'info, StakeRequest>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    /// CHECK: Sysvar instruction check applied
    #[account(address = sysvar::instructions::ID)]
    pub sysvar_info: AccountInfo<'info>
}

impl<'info> NativeUnstakeSetup<'info> {
    pub fn get_hash() -> [u8; 8] {
        get_function_hash("global", "native_unstake_setup")
    }

    pub fn validate(ctx: &Context<Self>, amount_in: u64) -> Result<()> {
        require_gt!(amount_in, 0, ErrorCode::ZeroAmount);

        require!(ctx.accounts.permission.can_borrow_from_vaults(), ErrorCode::InvalidPermissions);

        setup_transaction_introspection_validation(
            &ctx.accounts.sysvar_info,
            NativeUnstakeCleanup::get_hash(),
            false,
        )?;

        Ok(())
    }

    fn approve_authority_delegation(&self, amount_in: u64) -> Result<()> {
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

        token_interface::approve(cpi_ctx, amount_in)
    }

    pub fn native_unstake_setup(
        &mut self, 
        amount_in: u64, 
        min_target_amount: u64, 
    ) -> Result<()> {
        self.approve_authority_delegation(amount_in)?;

        self.stake_request.set_inner(StakeRequest {
            min_target_amount,
            max_amount_in: amount_in,
            lp_vault_key: self.lp_vault.key(),
            native_yield: self.native_yield.key(),
            stake_cache: StakeCache {
                src_bal_before: self.collateral_vault.amount,
                dst_bal_before: self.vault.amount,
            }
        });

        Ok(())
    }
}
