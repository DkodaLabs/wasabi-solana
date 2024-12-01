use {
    crate::{
        error::ErrorCode,
        events::{PositionClosed, PositionClosedWithOrder, PositionLiquidated},
        long_pool_signer_seeds, short_pool_signer_seeds,
        utils::validate_difference,
        BasePool, ClosePositionRequest, DebtController, GlobalSettings, LpVault, Position,
    },
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{
        self, Mint, Revoke, TokenAccount, TokenInterface, TransferChecked,
    },
};

pub enum CloseAction {
    Market,
    Liquidation,
    ExitOrder(u8),
}

#[derive(Accounts)]
pub struct ClosePositionCleanup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    /// CHECK: No need
    pub owner: AccountInfo<'info>,

    #[account(
        mut,
        has_one = owner,
    )]
    pub owner_payout_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The Long or Short Pool that owns the Position
    #[account(
        has_one = currency_vault,
        has_one = collateral_vault,
    )]
    pub pool: Box<Account<'info, BasePool>>,

    /// The collateral account that is the source of the swap
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The token account that is the destination of the swap
    #[account(mut)]
    pub currency_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency: Box<InterfaceAccount<'info, Mint>>,
    pub collateral: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        close = authority,
        seeds = [b"close_pos", owner.key().as_ref()],
        bump,
    )]
    pub close_position_request: Box<Account<'info, ClosePositionRequest>>,

    #[account(
        mut,
        close = owner,
        has_one = collateral_vault,
        has_one = lp_vault,
    )]
    pub position: Box<Account<'info, Position>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = vault,
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,
    /// The LP Vault's token account.
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = fee_wallet.owner == global_settings.fee_wallet
    )]
    pub fee_wallet: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = liquidation_wallet.owner == global_settings.liquidation_wallet
    )]
    pub liquidation_wallet: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [b"debt_controller"],
        bump,
    )]
    pub debt_controller: Box<Account<'info, DebtController>>,

    #[account(
        seeds = [b"global_settings"],
        bump,
    )]
    pub global_settings: Box<Account<'info, GlobalSettings>>,

    pub currency_token_program: Interface<'info, TokenInterface>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
}

impl<'info> ClosePositionCleanup<'info> {
    fn get_principal_delta(&self) -> Result<u64> {
        Ok(self
            .currency_vault
            .amount
            .checked_sub(self.close_position_request.swap_cache.taker_bal_before)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }

    fn get_collateral_delta(&self) -> Result<u64> {
        Ok(self
            .close_position_request
            .swap_cache
            .maker_bal_before
            .checked_sub(self.collateral_vault.amount)
            .ok_or(ErrorCode::ArithmeticUnderflow)?)
    }

    fn validate(&self) -> Result<()> {
        // Validate the same position was used in setup and cleanup
        require_keys_eq!(
            self.position.key(),
            self.close_position_request.position,
            ErrorCode::InvalidPosition
        );

        // Validate the same pool, and thus collateral_vault was used in setup and cleanup.
        require_keys_eq!(
            self.pool.key(),
            self.close_position_request.pool_key,
            ErrorCode::InvalidPool
        );

        require_gte!(
            self.get_principal_delta()?,
            self.close_position_request.min_target_amount,
            ErrorCode::MinTokensNotMet
        );

        require_gte!(
            self.position.collateral_amount,
            self.get_collateral_delta()?,
            ErrorCode::MaxSwapExceeded
        );

        require_keys_eq!(
            *self.owner_payout_account.to_account_info().owner,
            if self.pool.is_long_pool {
                self.currency_token_program.key()
            } else {
                self.collateral_token_program.key()
            },
            ErrorCode::IncorrectTokenProgram,
        );

        require_keys_eq!(
            self.owner_payout_account.mint,
            if self.pool.is_long_pool {
                self.currency.key()
            } else {
                self.collateral.key()
            },
            ErrorCode::MintMismatch,
        );

        Ok(())
    }

    fn revoke_owner_delegation(&self, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let cpi_accounts = Revoke {
            source: self.collateral_vault.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.collateral_token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds,
        };
        token_interface::revoke(cpi_ctx)
    }

    /// Transfers funds from the pool account to the LP vault account
    fn transfer_from_pool_to_vault(&self, amount: u64) -> Result<()> {
        if self.pool.is_long_pool {
            let cpi_accounts = TransferChecked {
                from: self.currency_vault.to_account_info(),
                mint: self.currency.to_account_info(),
                to: self.vault.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.currency_token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[long_pool_signer_seeds!(self.pool)],
            };
            token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
        } else {
            let cpi_accounts = TransferChecked {
                from: self.currency_vault.to_account_info(),
                mint: self.currency.to_account_info(),
                to: self.vault.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.currency_token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[short_pool_signer_seeds!(self.pool)],
            };
            token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
        }
    }

    fn transfer_fees(&self, amount: u64) -> Result<()> {
        if self.pool.is_long_pool {
            // Fees for long are paid in Currency token (typically SOL)
            let cpi_accounts = TransferChecked {
                from: self.currency_vault.to_account_info(),
                mint: self.currency.to_account_info(),
                to: self.fee_wallet.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.currency_token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[long_pool_signer_seeds!(self.pool)],
            };
            token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
        } else {
            // Fees for shorts are paid in collateral token (typically SOL)
            let cpi_accounts = TransferChecked {
                from: self.collateral_vault.to_account_info(),
                mint: self.collateral.to_account_info(),
                to: self.fee_wallet.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.collateral_token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[short_pool_signer_seeds!(self.pool)],
            };
            token_interface::transfer_checked(cpi_ctx, amount, self.collateral.decimals)
        }
    }

    fn transfer_liquidation_fee(&self, amount: u64) -> Result<()> {
        if self.pool.is_long_pool {
            // Fees for long are paid in Currency token (typically SOL)
            let cpi_accounts = TransferChecked {
                from: self.currency_vault.to_account_info(),
                mint: self.currency.to_account_info(),
                to: self.liquidation_wallet.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.currency_token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[long_pool_signer_seeds!(self.pool)],
            };
            token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
        } else {
            // Fees for shorts are paid in collateral token (typically SOL)
            let cpi_accounts = TransferChecked {
                from: self.collateral_vault.to_account_info(),
                mint: self.collateral.to_account_info(),
                to: self.liquidation_wallet.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.collateral_token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[short_pool_signer_seeds!(self.pool)],
            };
            token_interface::transfer_checked(cpi_ctx, amount, self.collateral.decimals)
        }
    }

    fn transfer_payout_from_pool_to_user(&self, amount: u64) -> Result<()> {
        if self.pool.is_long_pool {
            let cpi_accounts = TransferChecked {
                from: self.currency_vault.to_account_info(),
                mint: self.currency.to_account_info(),
                to: self.owner_payout_account.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.currency_token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[long_pool_signer_seeds!(self.pool)],
            };
            token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
        } else {
            // short must payout user in collateral (i.e. SOL for WIF/SOL)
            let cpi_accounts = TransferChecked {
                from: self.collateral_vault.to_account_info(),
                mint: self.collateral.to_account_info(),
                to: self.owner_payout_account.to_account_info(),
                authority: self.pool.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.collateral_token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[short_pool_signer_seeds!(self.pool)],
            };
            token_interface::transfer_checked(cpi_ctx, amount, self.collateral.decimals)
        }
    }

    #[inline]
    fn update_total_assets(
        &mut self,
        close_action: &CloseAction,
        close_amounts: &CloseAmounts,
    ) -> Result<()> {
        if close_amounts.principal_repaid < self.position.principal {
            // Revert if the close order is not a liquidation and is causing bad debt
            match close_action {
                CloseAction::Market | CloseAction::ExitOrder(_) => {
                    return Err(ErrorCode::BadDebt.into())
                }
                _ => (),
            }

            // Deduct principal repaid from principal
            let loss = self
                .position
                .principal
                .checked_sub(close_amounts.principal_repaid)
                .ok_or(ErrorCode::ArithmeticUnderflow)?;

            // Deduct loss from total assets
            self.lp_vault.total_assets = self
                .lp_vault
                .total_assets
                .checked_sub(loss)
                .ok_or(ErrorCode::ArithmeticUnderflow)?;
            Ok(())
        } else {
            // Increment total assets of the LP vault
            self.lp_vault.total_assets = self
                .lp_vault
                .total_assets
                .checked_add(close_amounts.interest_paid)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
            Ok(())
        }
    }

    pub fn close_position_cleanup(&mut self, close_action: &CloseAction) -> Result<CloseAmounts> {
        self.validate()?;
        let mut close_amounts = CloseAmounts::default();

        if self.pool.is_long_pool {
            self.revoke_owner_delegation(&[long_pool_signer_seeds!(self.pool)])?;
        } else {
            self.revoke_owner_delegation(&[short_pool_signer_seeds!(self.pool)])?;
        }

        let collateral_spent = self.get_collateral_delta()?;
        let principal_payout = self.get_principal_delta()?;
        let interest = self.close_position_request.interest;

        if self.pool.is_long_pool && collateral_spent < self.position.collateral_amount {
            msg!(
                "Collateral dust: {}",
                self.position.collateral_amount - collateral_spent
            );
        }

        // Cap interest based on DebtController
        let now = Clock::get()?.unix_timestamp;
        let max_interest = self.debt_controller.compute_max_interest(
            self.position.principal,
            self.position.last_funding_timestamp,
            now,
        )?;

        let interest: u64 = if interest == 0 || interest > max_interest {
            max_interest
        } else {
            interest
        };

        close_amounts.payout = if self.pool.is_long_pool {
            // Deduct principal
            let (principal_payout, principal_repaid) =
                crate::utils::deduct(principal_payout, self.position.principal);
            close_amounts.principal_repaid = principal_repaid;

            // Deduct interest
            let (principal_payout, interest_paid) =
                crate::utils::deduct(principal_payout, interest);
            close_amounts.interest_paid = interest_paid;

            principal_payout
        } else {
            // Deduct principal
            let (principal_payout, principal_repaid) =
                crate::utils::deduct(principal_payout, self.position.principal);
            close_amounts.principal_repaid = principal_repaid;

            // The remaining amount is principal
            close_amounts.interest_paid = principal_payout;

            if close_amounts.interest_paid > 0 {
                validate_difference(interest, close_amounts.interest_paid, 3)?;
            }

            // Payout and fees are paid in collateral
            let (payout, _) =
                crate::utils::deduct(self.position.collateral_amount, collateral_spent);
            payout
        };

        let close_fee = self
            .position
            .compute_close_fee(close_amounts.payout, self.pool.is_long_pool)?;

        // Deduct fees
        let (mut payout, close_fee) = crate::utils::deduct(
            close_amounts.payout,
            close_fee
                .checked_add(self.close_position_request.execution_fee)
                .ok_or(ErrorCode::ArithmeticOverflow)?,
        );

        // Update close fee before calculating liquidation fee
        close_amounts.close_fee = close_fee;

        match close_action {
            CloseAction::Liquidation => {
                // Liquidation fee is % of down_payment
                let liquidation_fee = self
                    .position
                    .down_payment
                    .checked_mul(self.debt_controller.liquidation_fee as u64)
                    .ok_or(ErrorCode::ArithmeticOverflow)?
                    .checked_div(100)
                    .ok_or(ErrorCode::ArithmeticOverflow)?;

                // Deduct from the payout
                let (liquidation_payout, actual_liquidation_fee) =
                    crate::utils::deduct(payout, liquidation_fee);

                // Transfer liquidation fee
                self.transfer_liquidation_fee(actual_liquidation_fee)?;

                // Payout is now decremented by `liquidation_fee`
                payout = liquidation_payout;
                close_amounts.liquidation_fee = actual_liquidation_fee;
            }
            _ => (),
        }

        close_amounts.payout = payout;
        close_amounts.collateral_spent = collateral_spent;
        close_amounts.past_fees = self.position.fees_to_be_paid;

        // Update the value of `lp_vault.total_assets` based on `close_action`
        self.update_total_assets(&close_action, &close_amounts)?;

        // Transfer the principal and interest amount to the LP Vault.
        self.transfer_from_pool_to_vault(
            close_amounts
                .principal_repaid
                .checked_add(close_amounts.interest_paid)
                .ok_or(ErrorCode::ArithmeticOverflow)?,
        )?;

        // Pay fees
        self.transfer_fees(close_fee)?;

        // Transfer payout
        self.transfer_payout_from_pool_to_user(close_amounts.payout)?;

        // Emit close event
        match close_action {
            CloseAction::Market => {
                emit!(PositionClosed::new(
                    &self.position,
                    &close_amounts,
                    self.pool.is_long_pool
                ))
            }
            CloseAction::Liquidation => {
                emit!(PositionLiquidated::new(
                    &self.position,
                    &close_amounts,
                    self.pool.is_long_pool
                ))
            }
            CloseAction::ExitOrder(order_type) => {
                emit!(PositionClosedWithOrder::new(
                    &self.position,
                    &close_amounts,
                    self.pool.is_long_pool,
                    *order_type
                ))
            }
        }

        Ok(close_amounts)
    }
}

#[derive(Default)]
pub struct CloseAmounts {
    pub payout: u64,
    pub collateral_spent: u64,
    pub interest_paid: u64,
    pub principal_repaid: u64,
    pub past_fees: u64,
    pub close_fee: u64,
    pub liquidation_fee: u64,
}
