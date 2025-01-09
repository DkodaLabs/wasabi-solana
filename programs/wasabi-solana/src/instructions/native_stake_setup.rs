use {
    super::NativeStakeCleanup,
    crate::{
        error::ErrorCode, lp_vault_signer_seeds, utils::setup_transaction_introspection_validation,
        LpVault, NativeYield, Permission, StakeCache, StakeRequest,
    },
    anchor_lang::{prelude::*, solana_program::sysvar},
    anchor_spl::token_interface::{self, Approve, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
pub struct NativeStakeSetup<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

    #[account(mut, has_one = vault)]
    pub lp_vault: Account<'info, LpVault>,
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency: Box<InterfaceAccount<'info, Mint>>,
    pub collateral: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        seeds = [b"stake_req", native_yield.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<StakeRequest>()
    )]
    pub stake_request: Account<'info, StakeRequest>,
    // Init beforehand
    #[account(
        mut,
        has_one = collateral_vault,
        seeds = [b"native_yield", lp_vault.key().as_ref()],
        bump,
    )]
    pub native_yield: Account<'info, NativeYield>,
    // Ensure initialised beforehand
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency_token_program: Interface<'info, TokenInterface>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> NativeStakeSetup<'info> {
    pub fn validate(ctx: &Context<Self>, last_updated: i64) -> Result<()> {
        let now = Clock::get()?;

        require_gt!(last_updated, now, ErrorCode::LastUpdatedTooSoon);

        require!(
            ctx.accounts.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions
        );

        setup_transaction_introspection_validation(
            &ctx.accounts.sysar_info,
            NativeStakeCleanup::get_hash(),
            true,
        )?;

        Ok(())
    }

    fn approve_authority_delegation(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Approve {
            to: self.vault.to_account_info(),
            delegate: self.authority.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };

        token_interface::approve(ctx_ctx, amount)
    }

    pub fn stake_setup(&mut self, amount: u64, min_target_amount: u64) -> Result<()> {
        self.approve_authority_delegation(amount)?;

        self.stake_request.set_inner(StakeRequest {
            swap_cache: SwapCache {},
            max_amount_in: amount,
            min_target_amount,
            lp_vault_key: self.lp_vault.key(),
            native_yield: self.native_yield.key(),
        });

        Ok(())
    }
}
