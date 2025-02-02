use {
    super::NativeStakeCleanup,
    crate::{
        error::ErrorCode, lp_vault_signer_seeds, utils::setup_transaction_introspection_validation,
        LpVault, NativeYield, Permission, StakeCache, StakeRequest,
    },
    anchor_lang::{prelude::*, solana_program::sysvar},
    anchor_spl::token_interface::{self, Approve, TokenAccount, TokenInterface, Mint},
};

#[derive(Accounts)]
pub struct NativeStakeSetup<'info> {
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

    /// Temporary 'cache' account to store the state of the stake request between instructions
    #[account(
        init,
        payer = authority,
        seeds = [b"stake_req", native_yield.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<StakeRequest>()
    )]
    pub stake_request: Account<'info, StakeRequest>,

    /// The 'strategy'
    // Init beforehand
    #[account(
        mut,
        has_one = collateral,
        has_one = collateral_vault,
        has_one = lp_vault,
        seeds = [
            b"native_yield",
            lp_vault.key().as_ref(),
            collateral.key().as_ref()
        ],
        bump,
    )]
    pub native_yield: Account<'info, NativeYield>,

    /// The lp vault's token account 
    /// Holds the 'collateral' token
    // Ensure initialised beforehand
    #[account(constraint = collateral_vault.owner == lp_vault.key())]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    /// CHECK: Sysvar instruction check applied
    #[account(address = sysvar::instructions::ID)]
    pub sysvar_info: AccountInfo<'info>,
}

impl<'info> NativeStakeSetup<'info> {
    pub fn validate(ctx: &Context<Self>, amount_in: u64) -> Result<()> {
        require_gt!(amount_in, 0, ErrorCode::ZeroAmount);

        require!(
            ctx.accounts.permission.can_borrow_from_vaults(),
            ErrorCode::InvalidPermissions
        );

        // Ensure there is a clean up instruction
        setup_transaction_introspection_validation(
            &ctx.accounts.sysvar_info,
            NativeStakeCleanup::get_hash(),
            false,
        )?;

        Ok(())
    }

    // Approve the authority to stake the given amount on behalf of the lp vault
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

    pub fn native_stake_setup(&mut self, amount_in: u64, min_target_amount: u64) -> Result<()> {
        self.approve_authority_delegation(amount_in)?;

        self.stake_request.set_inner(StakeRequest {
            stake_cache: StakeCache {
                src_bal_before: self.vault.amount,
                dst_bal_before: self.collateral_vault.amount,
            },
            max_amount_in: amount_in,
            min_target_amount,
            lp_vault_key: self.lp_vault.key(),
            native_yield: self.native_yield.key(),
        });

        Ok(())
    }
}
