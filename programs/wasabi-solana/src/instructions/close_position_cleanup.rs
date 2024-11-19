use {
    crate::{
        error::ErrorCode,
        events::{PositionClosed, PositionLiquidated},
        long_pool_signer_seeds, short_pool_signer_seeds,
        utils::validate_difference,
        BasePool, ClosePositionRequest, DebtController, GlobalSettings, LpVault, Position,
    },
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{
        self, Mint, Revoke, TokenAccount, TokenInterface, TransferChecked,
    },
};

#[derive(Accounts)]
pub struct ClosePositionCleanup<'info> {
    #[account(mut)]
    /// The wallet that owns the assets
    /// CHECK: No need
    pub owner: AccountInfo<'info>,

    /// The account that holds the owner's collateral currency.
    /// NOTE: this account is only used when closing `Short` Positions
    #[account(
        mut,
        associated_token::mint = collateral,
        associated_token::authority = owner,
        associated_token::token_program = collateral_token_program,
    )]
    pub owner_collateral_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The account that holds the owner's base currency
    #[account(
        mut,
        associated_token::mint = currency,
        associated_token::authority = owner,
        associated_token::token_program = currency_token_program,
    )]
    pub owner_currency_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The Long or Short Pool that owns the Position
    #[account(
        has_one = currency_vault,
        has_one = collateral_vault,
    )]
    pub pool: Account<'info, BasePool>,

    /// The collateral account that is the source of the swap
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The token account that is the destination of the swap
    #[account(mut)]
    pub currency_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub currency: InterfaceAccount<'info, Mint>,
    pub collateral: InterfaceAccount<'info, Mint>,

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
        has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,
    /// The LP Vault's token account.
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub fee_wallet: Box<InterfaceAccount<'info, TokenAccount>>,

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

    pub currency_token_program: Interface<'info, TokenInterface>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
}

impl<'info> ClosePositionCleanup<'info> {
    fn get_destination_delta(&self) -> Result<u64> {
        if self.pool.is_long_pool {
            Ok(self
                .currency_vault
                .amount
                .checked_sub(
                    self.close_position_request
                        .swap_cache
                        .destination_bal_before,
                )
                .ok_or(ErrorCode::ArithmeticOverflow)?)
        } else {
            Ok(self
                .currency_vault
                .amount
                .checked_sub(
                    self.close_position_request
                        .swap_cache
                        .destination_bal_before,
                )
                .ok_or(ErrorCode::ArithmeticOverflow)?)
        }
    }

    fn get_source_delta(&self) -> Result<u64> {
        if self.pool.is_long_pool {
            Ok(self
                .close_position_request
                .swap_cache
                .source_bal_before
                .checked_sub(self.collateral_vault.amount)
                .ok_or(ErrorCode::ArithmeticOverflow)?)
        } else {
            Ok(self
                .close_position_request
                .swap_cache
                .source_bal_before
                .checked_sub(self.collateral_vault.amount)
                .ok_or(ErrorCode::ArithmeticOverflow)?)
        }
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

        // Validate owner receives at least the minimum amount of token being swapped to.
        //if self.get_destination_delta() < self.close_position_request.min_target_amount {
        //    return Err(ErrorCode::MinTokensNotMet.into());
        //}
        require_gte!(
            self.get_destination_delta()?,
            self.close_position_request.min_target_amount,
            ErrorCode::MinTokensNotMet
        );

        require_gt!(self.get_source_delta()?, 0, ErrorCode::MaxSwapExceeded);

        // NOTE: DISABLED FOR TESTING
        //require_keys_eq!(
        //    self.fee_wallet.owner,
        //    self.global_settings.protocol_fee_wallet,
        //    ErrorCode::IncorrectFeeWallet
        //);

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

    fn transfer_payout_from_pool_to_user(&self, amount: u64) -> Result<()> {
        if self.pool.is_long_pool {
            let cpi_accounts = TransferChecked {
                from: self.currency_vault.to_account_info(),
                mint: self.currency.to_account_info(),
                to: self.owner_currency_account.to_account_info(),
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
                to: self.owner_collateral_account.to_account_info(),
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

    pub fn close_position_cleanup(&mut self, is_liquidation: bool) -> Result<CloseAmounts> {
        self.validate()?;
        let mut close_amounts = CloseAmounts::default();

        if self.pool.is_long_pool {
            self.revoke_owner_delegation(&[long_pool_signer_seeds!(self.pool)])?;
        } else {
            self.revoke_owner_delegation(&[short_pool_signer_seeds!(self.pool)])?;
        }

        let close_position_req = &self.close_position_request;
        let collateral_spent = self.get_source_delta()?;
        let currency_diff = self.get_destination_delta()?;
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

        // Calc fees https://github.com/DkodaLabs/wasabi_perps/blob/4f597e6293e0de00c6133af7cffd3a680f463d6c/contracts/PerpUtils.sol#L28-L37
        close_amounts.payout = if self.pool.is_long_pool {
            // Deduct principal
            let (payout, principal_repaid) =
                crate::utils::deduct(currency_diff, self.position.principal);
            close_amounts.principal_repaid = principal_repaid;

            // Deduct interest
            let (payout, interest_paid) = crate::utils::deduct(payout, interest);
            close_amounts.interest_paid = interest_paid;

            payout
        } else {
            close_amounts.principal_repaid = currency_diff;

            let (remaining_after_interest, interest_paid) =
                crate::utils::deduct(currency_diff, interest);
            close_amounts.interest_paid = interest_paid;

            let (_payout, principal_repaid) =
                crate::utils::deduct(remaining_after_interest, self.position.principal);
            close_amounts.principal_repaid = principal_repaid;

            // Deduct interest
            //(close_amounts.interest_paid, close_amounts.principal_repaid) =
            //    crate::utils::deduct(close_amounts.principal_repaid, self.position.principal);

            if close_amounts.interest_paid > 0 {
                validate_difference(interest, close_amounts.interest_paid, 5)?;
            }

            // Payout and fees are paid in collateral
            let (payout, _) =
                crate::utils::deduct(self.position.collateral_amount, collateral_spent);
            payout
        };

        // Deduct fees
        let (payout, close_fee) =
            crate::utils::deduct(close_amounts.payout, close_position_req.execution_fee);
        close_amounts.payout = payout;
        close_amounts.close_fee = close_fee;
        close_amounts.collateral_spent = collateral_spent;
        close_amounts.past_fees = self.position.fees_to_be_paid;

        // Records the payment ([evm src](https://github.com/DkodaLabs/wasabi_perps/blob/8ba417b4755afafed703ab5d3eaa7070ad551709/contracts/BaseWasabiPool.sol#L133))
        // Transfer the principal and interest amount to the LP Vault.
        self.transfer_from_pool_to_vault(
            self.position
                .principal
                .checked_add(interest)
                .expect("overflow"),
        )?;

        // Pay fees
        self.transfer_fees(close_fee)?;

        // Transfer payout
        self.transfer_payout_from_pool_to_user(close_amounts.payout)?;

        // Emit close event
        if is_liquidation {
            emit!(PositionLiquidated::new(
                &self.position,
                &close_amounts,
                self.pool.is_long_pool
            ))
        } else {
            emit!(PositionClosed::new(
                &self.position,
                &close_amounts,
                self.pool.is_long_pool
            ))
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
}
