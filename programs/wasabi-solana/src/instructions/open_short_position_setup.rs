use anchor_lang::{prelude::*, solana_program::sysvar};
use anchor_spl::token::{self, Approve, Token, TokenAccount, Transfer};

use crate::{
    error::ErrorCode, lp_vault_signer_seeds, short_pool_signer_seeds,
    utils::position_setup_transaction_introspecation_validation, BasePool, LpVault,
    OpenPositionRequest, Permission, Position,
};

use super::OpenShortPositionCleanup;

#[derive(Accounts)]
#[instruction(args: OpenShortPositionArgs)]
pub struct OpenShortPositionSetup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    pub owner: Signer<'info>,
    #[account(mut)]
    /// The account that holds the owner's base currency
    pub owner_currency_account: Account<'info, TokenAccount>,

    #[account(mut)]
    /// The account that holds the owner's target currency
    pub owner_target_currency_account: Account<'info, TokenAccount>,

    /// The LP Vault that the user will borrow from
    #[account(
      has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,
    #[account(mut)]
    /// The LP Vault's token account.
    pub vault: Account<'info, TokenAccount>,

    #[account(
        has_one = collateral_vault,
        has_one = currency_vault,
    )]
    /// The ShortPool that owns the Position
    pub short_pool: Account<'info, BasePool>,
    #[account(mut)]
    /// The collateral account that is the destination of the swap
    pub collateral_vault: Account<'info, TokenAccount>,

    // The token account that is the source of the swap (where principal and downpayment are sent)
    #[account(mut)]
    pub currency_vault: Box<Account<'info, TokenAccount>>,

    #[account(
      init,
      payer = owner,
      seeds = [b"open_pos", owner.key().as_ref()],
      bump,
      space = 8 + std::mem::size_of::<OpenPositionRequest>(),
    )]
    pub open_position_request: Account<'info, OpenPositionRequest>,

    #[account(
      init,
      payer = owner,
      seeds = [b"position", owner.key().as_ref(), short_pool.key().as_ref(), lp_vault.key().as_ref(), &args.nonce.to_le_bytes()],
      bump,
      space = 8 + std::mem::size_of::<Position>(),
    )]
    pub position: Box<Account<'info, Position>>,

    pub authority: Signer<'info>,

    #[account(
      has_one = authority,
    )]
    pub permission: Account<'info, Permission>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    #[account(
      address = sysvar::instructions::ID
    )]
    /// CHECK: Sysvar instruction check applied
    pub sysvar_info: AccountInfo<'info>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct OpenShortPositionArgs {
    /// The nonce of the Position
    pub nonce: u16,
    /// The minimum amount out required when swapping
    pub min_target_amount: u64,
    /// The initial down payment amount required to open the position (is in `currency` for long, `collateralCurrency` for short positions)
    pub down_payment: u64,
    /// The total principal amount to be borrowed for the position.
    pub principal: u64,
    /// The address of the currency to be borrowed and sold for the position.
    pub currency: Pubkey,
    /// The timestamp when this position request expires.
    pub expiration: i64,
}

impl<'info> OpenShortPositionSetup<'info> {
    pub fn validate(ctx: &Context<Self>, _args: &OpenShortPositionArgs) -> Result<()> {
        if !ctx.accounts.permission.can_cosign_swaps() {
            return Err(ErrorCode::InvalidSwapCosigner.into());
        }

        // Validate TX only has only one setup IX and has one following cleanup IX
        position_setup_transaction_introspecation_validation(
            &ctx.accounts.sysvar_info,
            OpenShortPositionCleanup::get_hash(),
        )?;

        Ok(())
    }

    pub fn transfer_from_user_to_collateral_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.owner_target_currency_account.to_account_info(),
            to: self.collateral_vault.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)
    }

    pub fn transfer_from_lp_vault_to_currency_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.currency_vault.to_account_info(),
            authority: self.lp_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[lp_vault_signer_seeds!(self.lp_vault)],
        };
        token::transfer(cpi_ctx, amount)
    }

    pub fn approve_owner_delegation(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Approve {
            to: self.currency_vault.to_account_info(),
            delegate: self.owner.to_account_info(),
            authority: self.short_pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: &[short_pool_signer_seeds!(self.short_pool)],
        };
        token::approve(cpi_ctx, amount)
    }
}

pub fn handler(ctx: Context<OpenShortPositionSetup>, args: OpenShortPositionArgs) -> Result<()> {
    // Down payment is transfered from user to collateral_vault since it's
    // not used for swapping when opening a short position.
    ctx.accounts
        .transfer_from_user_to_collateral_vault(args.down_payment)?;

    // Reload the collateral_vault account so we can get the balance after
    // downpayment has been made.
    ctx.accounts.collateral_vault.reload()?;

    let total_to_swap = args.principal;

    // Approve user to make swap on behalf of `currency_vault`
    ctx.accounts.approve_owner_delegation(total_to_swap)?;

    // Cache data on the `open_position_request` account. We use the value
    // after the borrow in order to track the entire amount being swapped.
    let open_position_request = &mut ctx.accounts.open_position_request;

    open_position_request.position = ctx.accounts.position.key();
    open_position_request.pool_key = ctx.accounts.short_pool.key();
    open_position_request.min_target_amount = args.min_target_amount;
    open_position_request.swap_cache.destination_bal_before = ctx.accounts.collateral_vault.amount;
    open_position_request.swap_cache.source_bal_before = ctx.accounts.currency_vault.amount;

    let position = &mut ctx.accounts.position;
    position.trader = ctx.accounts.owner.key();
    position.currency = ctx.accounts.vault.mint;
    position.collateral_currency = ctx.accounts.collateral_vault.mint;
    position.down_payment = args.down_payment;
    position.principal = args.principal;
    position.collateral_vault = ctx.accounts.collateral_vault.key();
    position.lp_vault = ctx.accounts.lp_vault.key();

    // Transfer the borrowed amount to user's wallet to be used in swap.
    ctx.accounts
        .transfer_from_lp_vault_to_currency_vault(args.principal)?;

    Ok(())
}
