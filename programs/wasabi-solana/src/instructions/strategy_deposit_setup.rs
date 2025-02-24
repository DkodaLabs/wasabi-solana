use {
    super::StrategyDepositCleanup,
    crate::{
        error::ErrorCode,
        lp_vault_signer_seeds,
        state::{LpVault, Permission, Strategy, StrategyCache, StrategyRequest},
        utils::setup_transaction_introspection_validation,
    },
    anchor_lang::{prelude::*, solana_program::sysvar},
    anchor_spl::token_interface::{self, Approve, Mint, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
pub struct StrategyDepositSetup<'info> {
    /// The account that has permission to borrow from the vaults
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

    /// The lp vault being borrowed from
    #[account(mut, has_one = vault)]
    pub lp_vault: Account<'info, LpVault>,
    /// The token account for the asset which the lp vault holds
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The mint of the token that will be received for staking the vault asset
    pub collateral: Box<InterfaceAccount<'info, Mint>>,

    /// Temporary 'cache' account to store the state of the strategy request between instructions
    #[account(
        init,
        payer = authority,
        seeds = [b"strategy_request", strategy.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<StrategyRequest>()
    )]
    pub strategy_request: Account<'info, StrategyRequest>,

    /// The 'strategy'
    // Init beforehand
    #[account(
        mut,
        has_one = collateral,
        has_one = collateral_vault,
        has_one = lp_vault,
        seeds = [
            b"strategy",
            lp_vault.key().as_ref(),
            collateral.key().as_ref()
        ],
        bump,
    )]
    pub strategy: Account<'info, Strategy>,

    /// The lp vault's token account
    /// Holds the 'collateral' token
    // Ensure initialized beforehand
    #[account(constraint = collateral_vault.owner == lp_vault.key())]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    /// CHECK: Sysvar instruction check applied
    #[account(address = sysvar::instructions::ID)]
    pub sysvar_info: AccountInfo<'info>,
}

impl<'info> StrategyDepositSetup<'info> {
    pub fn validate(ctx: &Context<Self>, amount_in: u64) -> Result<()> {
        require_gt!(amount_in, 0, ErrorCode::ZeroAmount);

        require!(
            ctx.accounts.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions
        );

        // Ensure there is a cleanup instruction
        setup_transaction_introspection_validation(
            &ctx.accounts.sysvar_info,
            StrategyDepositCleanup::get_hash(),
            false,
        )?;

        Ok(())
    }

    // Approve the authority to strategy the given amount on behalf of the lp vault
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

        token_interface::approve(cpi_ctx, amount)
    }

    pub fn strategy_deposit_setup(&mut self, amount_in: u64, min_target_amount: u64) -> Result<()> {
        self.approve_authority_delegation(amount_in)?;

        self.strategy_request.set_inner(StrategyRequest {
            strategy_cache: StrategyCache {
                src_bal_before: self.vault.amount,
                dst_bal_before: self.collateral_vault.amount,
            },
            max_amount_in: amount_in,
            min_target_amount,
            lp_vault_key: self.lp_vault.key(),
            strategy: self.strategy.key(),
        });

        Ok(())
    }
}
