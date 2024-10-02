use anchor_lang::prelude::*;
use anchor_spl::token::{self, Revoke, Token, TokenAccount, Transfer};

use crate::{
    error::ErrorCode,
    events::{PositionClosed, PositionLiquidated},
    long_pool_signer_seeds, short_pool_signer_seeds,
    utils::validate_difference,
    BasePool, ClosePositionRequest, DebtController, GlobalSettings, LpVault, Position,
};

#[derive(Accounts)]
pub struct ClosePositionCleanup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    /// CHECK: No need
    pub owner: AccountInfo<'info>,
    #[account(mut)]
    /// The account that holds the owner's collateral currency.
    /// NOTE: this account is only used when closing `Short` Positions
    pub owner_collateral_account: Account<'info, TokenAccount>,
    #[account(mut)]
    /// The account that holds the owner's base currency
    pub owner_currency_account: Account<'info, TokenAccount>,

    #[account(
      has_one = collateral_vault,
    )]
    /// The Long or Short Pool that owns the Position
    pub pool: Account<'info, BasePool>,

    /// The collateral account that is the source of the swap
    pub collateral_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    /// The token account that is the destination of the swap
    pub currency_vault: Box<Account<'info, TokenAccount>>,

    #[account(
      mut,
      close = authority,
      seeds = [b"close_pos", owner.key().as_ref()],
      bump,
    )]
    pub close_position_request: Account<'info, ClosePositionRequest>,

    #[account(
      mut,
      close = owner,
      has_one = collateral_vault,
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// The LP Vault that the user borrowed from
    #[account(
      has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,
    #[account(mut)]
    /// The LP Vault's token account.
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub fee_wallet: Account<'info, TokenAccount>,

    #[account(
      seeds = [b"debt_controller"],
      bump,
    )]
    pub debt_controller: Account<'info, DebtController>,

    #[account(
        seeds = [b"global_settings"],
        bump,
    )]
    pub global_settings: Account<'info, GlobalSettings>,

    pub token_program: Program<'info, Token>,
}

impl<'info> ClosePositionCleanup<'info> {
    pub fn get_destination_delta(&self) -> u64 {
        if self.pool.is_long_pool {
            self.currency_vault
                .amount
                .checked_sub(
                    self.close_position_request
                        .swap_cache
                        .destination_bal_before,
                )
                .expect("overflow")
        } else {
            self.currency_vault
                .amount
                .checked_sub(
                    self.close_position_request
                        .swap_cache
                        .destination_bal_before,
                )
                .expect("overflow")
        }
    }

    pub fn get_source_delta(&self) -> u64 {
        if self.pool.is_long_pool {
            self.close_position_request
                .swap_cache
                .source_bal_before
                .checked_sub(self.collateral_vault.amount)
                .expect("overflow")
        } else {
            self.close_position_request
                .swap_cache
                .source_bal_before
                .checked_sub(self.collateral_vault.amount)
                .expect("overflow")
        }
    }

    pub fn validate(&self) -> Result<()> {
        // Validate the same position was used in setup and cleanup
        if self.position.key() != self.close_position_request.position {
            return Err(ErrorCode::InvalidPosition.into());
        }
        // Validate the same pool, and thus collateral_vault was used in setup and cleanup.
        if self.pool.key() != self.close_position_request.pool_key {
            return Err(ErrorCode::InvalidPool.into());
        }

        // Validate owner receives at least the minimum amount of token being swapped to.
        let destination_balance_delta = self.get_destination_delta();

        if destination_balance_delta < self.close_position_request.min_target_amount {
            return Err(ErrorCode::MinTokensNotMet.into());
        }

        let source_balance_delta = self.get_source_delta();

        if source_balance_delta > 0 {
            return Err(ErrorCode::MaxSwapExceeded.into());
        }

        require!(
            self.fee_wallet.owner == self.global_settings.protocol_fee_wallet,
            ErrorCode::IncorrectFeeWallet
        );

        Ok(())
    }

    pub fn revoke_owner_delegation(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let cpi_accounts = Revoke {
            source: self.collateral_vault.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: signer_seeds,
        };
        token::revoke(cpi_ctx)
    }

    /// Transfers funds from the pool account to the LP vault account
    pub fn transfer_from_pool_to_vault(&self, amount: u64) -> Result<()> {
        if self.pool.is_long_pool {
            let cpi_accounts = Transfer {
                from: self.currency_vault.to_account_info(),
                to: self.vault.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[long_pool_signer_seeds!(self.pool)],
            };
            token::transfer(cpi_ctx, amount)
        } else {
            let cpi_accounts = Transfer {
                from: self.currency_vault.to_account_info(),
                to: self.vault.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[short_pool_signer_seeds!(self.pool)],
            };
            token::transfer(cpi_ctx, amount)
        }
    }

    pub fn transfer_fees(&self, amount: u64) -> Result<()> {
        if self.pool.is_long_pool {
            // Fees for long are paid in Currency token (typically SOL)
            let cpi_accounts = Transfer {
                from: self.currency_vault.to_account_info(),
                to: self.fee_wallet.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[long_pool_signer_seeds!(self.pool)],
            };
            token::transfer(cpi_ctx, amount)
        } else {
            // Fees for shorts are paid in collateral token (typically SOL)
            let cpi_accounts = Transfer {
                from: self.collateral_vault.to_account_info(),
                to: self.fee_wallet.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[short_pool_signer_seeds!(self.pool)],
            };
            token::transfer(cpi_ctx, amount)
        }
    }

    pub fn transfer_payout_from_pool_to_user(&self, amount: u64) -> Result<()> {
        if self.pool.is_long_pool {
            let cpi_accounts = Transfer {
                from: self.currency_vault.to_account_info(),
                to: self.owner_currency_account.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[long_pool_signer_seeds!(self.pool)],
            };
            token::transfer(cpi_ctx, amount)
        } else {
            // short must payout user in collateral (i.e. SOL for WIF/SOL)
            let cpi_accounts = Transfer {
                from: self.collateral_vault.to_account_info(),
                to: self.owner_collateral_account.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[short_pool_signer_seeds!(self.pool)],
            };
            token::transfer(cpi_ctx, amount)
        }
    }
}

#[derive(Default)]
pub struct CloseAmounts {
    pub payout: u64,
    pub interest_paid: u64,
    pub principal_repaid: u64,
    pub close_fee: u64,
}

pub fn shared_position_cleanup(
    close_position_cleanup: &mut ClosePositionCleanup,
    is_liquidation: bool,
) -> Result<CloseAmounts> {
    let mut close_amounts = CloseAmounts::default();
    // revoke "owner" ability to swap on behalf of the collateral vault
    if close_position_cleanup.pool.is_long_pool {
        close_position_cleanup
            .revoke_owner_delegation(&[long_pool_signer_seeds!(close_position_cleanup.pool)])?;
    } else {
        close_position_cleanup
            .revoke_owner_delegation(&[short_pool_signer_seeds!(close_position_cleanup.pool)])?;
    }
    // Total currency received after the swap.
    let close_position_request = &close_position_cleanup.close_position_request;
    let collateral_spent = close_position_cleanup.get_source_delta();
    let currency_diff = close_position_cleanup.get_destination_delta();
    let interest = close_position_cleanup.close_position_request.interest;

    if close_position_cleanup.pool.is_long_pool
        && collateral_spent < close_position_cleanup.position.collateral_amount
    {
        let collateral_dust = close_position_cleanup.position.collateral_amount - collateral_spent;
        // TODO: What to do with any collateral_dust?
        msg!("collateral_dust: {}", collateral_dust);
    }

    // Cap interest based on DebtController
    let now = Clock::get()?.unix_timestamp;
    let max_interest = close_position_cleanup
        .debt_controller
        .compute_max_interest(
            close_position_cleanup.position.principal,
            close_position_cleanup.position.last_funding_timestamp,
            now,
        )?;
    let interest: u64 = if interest == 0 || interest > max_interest {
        max_interest
    } else {
        interest
    };

    // Calc fees https://github.com/DkodaLabs/wasabi_perps/blob/4f597e6293e0de00c6133af7cffd3a680f463d6c/contracts/PerpUtils.sol#L28-L37
    let position = &close_position_cleanup.position;
    close_amounts.payout = if close_position_cleanup.pool.is_long_pool {
        // 1. Deduct principal
        let (_payout, _principal_repaid) = crate::utils::deduct(currency_diff, position.principal);
        close_amounts.principal_repaid = _principal_repaid;
        // 2. Deduct interest
        let (_payout, _interest_paid) = crate::utils::deduct(_payout, interest);
        close_amounts.interest_paid = _interest_paid;
        _payout
    } else {
        close_amounts.principal_repaid = currency_diff;

        // 1. Deduct interest
        (close_amounts.interest_paid, close_amounts.principal_repaid) =
            crate::utils::deduct(close_amounts.principal_repaid, position.principal);
        if close_amounts.interest_paid > 0 {
            validate_difference(interest, close_amounts.interest_paid, 3)?;
        }

        // Payout and fees are paid in collateral
        let (_payout, _) = crate::utils::deduct(position.collateral_amount, collateral_spent);
        _payout
    };
    // Deduct fees
    let (payout, close_fee) =
        crate::utils::deduct(close_amounts.payout, close_position_request.execution_fee);
    close_amounts.payout = payout;
    close_amounts.close_fee = close_fee;

    // Records the payment ([evm src](https://github.com/DkodaLabs/wasabi_perps/blob/8ba417b4755afafed703ab5d3eaa7070ad551709/contracts/BaseWasabiPool.sol#L133))
    let lp_vault_payment = position
        .principal
        .checked_add(interest)
        .expect("overflow");
    // Transfer the prinicpal and interest amount to the LP Vault.
    close_position_cleanup.transfer_from_pool_to_vault(lp_vault_payment)?;
    if currency_diff < lp_vault_payment && !is_liquidation {
        return Err(ErrorCode::BadDebt.into());
    }

    // Pay the fees
    close_position_cleanup.transfer_fees(close_fee)?;

    // Transfer payout
    close_position_cleanup.transfer_payout_from_pool_to_user(close_amounts.payout)?;

    // Emit close events
    if is_liquidation {
        emit!(PositionLiquidated::new(position, &close_amounts))
    } else {
        emit!(PositionClosed::new(position, &close_amounts))
    }
    Ok(close_amounts)
}
