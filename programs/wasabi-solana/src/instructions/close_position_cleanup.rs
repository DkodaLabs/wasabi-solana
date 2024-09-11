use anchor_lang::prelude::*;
use anchor_spl::token::{self, Revoke, Token, TokenAccount, Transfer};

use crate::{
    error::ErrorCode, long_pool_signer_seeds, short_pool_signer_seeds, BasePool,
    ClosePositionRequest, GlobalSettings, LpVault, Position,
};

#[derive(Accounts)]
pub struct ClosePositionCleanup<'info> {
    #[account(mut)]
    owner: Signer<'info>,
    #[account(mut)]
    /// The account that holds the owner's base currency
    pub owner_currency_account: Account<'info, TokenAccount>,

    #[account(
      has_one = collateral_vault,
    )]
    /// The Long or Short Pool that owns the Position
    pub pool: Account<'info, BasePool>,

    pub collateral_vault: Account<'info, TokenAccount>,
    #[account(
      mut,
      close = owner,
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

    pub global_settings: Account<'info, GlobalSettings>,

    pub token_program: Program<'info, Token>,
}

impl<'info> ClosePositionCleanup<'info> {
    pub fn get_destination_delta(&self) -> u64 {
        if self.pool.is_long_pool {
            self.owner_currency_account
                .amount
                .checked_sub(
                    self.close_position_request
                        .swap_cache
                        .destination_bal_before,
                )
                .expect("overflow")
        } else {
            self.owner_currency_account
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

    pub fn transfer_from_user_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.owner_currency_account.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)
    }

    pub fn transfer_fees(&self, amount: u64) -> Result<()> {
        if self.pool.is_long_pool {
            // Fees for long are paid in Currency token (typically SOL)
            let cpi_accounts = Transfer {
                from: self.owner_currency_account.to_account_info(),
                to: self.fee_wallet.to_account_info(),
                authority: self.owner.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
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
    let collateral_diff = close_position_cleanup.get_source_delta();
    let currency_diff = close_position_cleanup.get_destination_delta();

    if close_position_cleanup.pool.is_long_pool
        && collateral_diff < close_position_cleanup.position.collateral_amount
    {
        let collateral_dust = close_position_cleanup.position.collateral_amount - collateral_diff;
        // TODO: What to do with any collateral_dust?
        msg!("collateral_dust: {}", collateral_dust);
    }

    // TODO: Cap the interest with a max interest ([EVM source](https://github.com/DkodaLabs/wasabi_perps/blob/4f597e6293e0de00c6133af7cffd3a680f463d6c/contracts/BaseWasabiPool.sol#L188))

    // Calc fees https://github.com/DkodaLabs/wasabi_perps/blob/4f597e6293e0de00c6133af7cffd3a680f463d6c/contracts/PerpUtils.sol#L28-L37
    let position = &close_position_cleanup.position;
    close_amounts.payout = if close_position_cleanup.pool.is_long_pool {
        // 1. Deduct principal
        let (_payout, _principal_repaid) = crate::utils::deduct(currency_diff, position.principal);
        close_amounts.principal_repaid = _principal_repaid;
        // 2. Deduct interest
        let (_payout, _interest_paid) =
            crate::utils::deduct(currency_diff, close_position_request.interest);
        close_amounts.interest_paid = _interest_paid;
        _payout
    } else {
        close_amounts.principal_repaid = currency_diff;

        (close_amounts.interest_paid, close_amounts.principal_repaid) =
            crate::utils::deduct(close_amounts.principal_repaid, position.principal);

        let (_payout, _) = crate::utils::deduct(position.collateral_amount, collateral_diff);
        _payout
    };
    // Deduct fees
    let (payout, close_fee) = crate::utils::deduct(
        close_amounts.payout,
        position.compute_close_fee(
            close_amounts.payout,
            close_position_cleanup.pool.is_long_pool,
        ) + close_position_request.execution_fee,
        );
    close_amounts.payout = payout;
    close_amounts.close_fee = close_fee;

    // Records the payment ([evm src](https://github.com/DkodaLabs/wasabi_perps/blob/8ba417b4755afafed703ab5d3eaa7070ad551709/contracts/BaseWasabiPool.sol#L133))
    let lp_vault_payment = position
        .principal
        .checked_add(close_position_request.interest)
        .expect("overflow");
    // Transfer the prinicpal and interest amount to the LP Vault.
    close_position_cleanup.transfer_from_user_to_vault(lp_vault_payment)?;
    if currency_diff < lp_vault_payment && !is_liquidation {
        return Err(ErrorCode::BadDebt.into());
    }

    // Pay the fees
    let position_fees_to_transfer = position.fees_to_be_paid + close_fee;
    msg!("payout {} | position_fees_to_transfer {}", close_amounts.payout, position_fees_to_transfer);
    close_position_cleanup.transfer_fees(position_fees_to_transfer)?;
    Ok(close_amounts)
}
