use {
    super::close_position_cleanup::CloseAmounts,
    crate::{
        error::ErrorCode, events::PositionClaimed, long_pool_signer_seeds, short_pool_signer_seeds,
        BasePool, DebtController, GlobalSettings, LpVault, Position,
    },
    anchor_lang::prelude::*,
    anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

#[derive(Accounts)]
pub struct ClaimPosition<'info> {
    #[account(mut)]
    /// The wallet that owns the Position
    pub trader: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = currency,
        associated_token::authority = trader,
        associated_token::token_program = currency_token_program,
    )]
    pub trader_currency_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = collateral,
        associated_token::authority = trader,
        associated_token::token_program = collateral_token_program,
    )]
    pub trader_collateral_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        close = trader,
        has_one = trader,
        has_one = lp_vault,
        has_one = collateral_vault,
    )]
    pub position: Box<Account<'info, Position>>,

    #[account(
        has_one = collateral_vault,
    )]
    pub pool: Account<'info, BasePool>,

    #[account(mut)]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral: InterfaceAccount<'info, Mint>,
    pub currency: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,

    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = fee_wallet.owner == global_settings.fee_wallet
    )]
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

    pub collateral_token_program: Interface<'info, TokenInterface>,
    pub currency_token_program: Interface<'info, TokenInterface>,
}
impl ClaimPosition<'_> {
    pub fn transfer_from_trader_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.trader_currency_account.to_account_info(),
            mint: self.currency.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.trader.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.currency_token_program.to_account_info(), cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
    }

    pub fn transfer_from_collateral_vault_to_trader(
        &self,
        amount: u64,
        pool_signer: &[&[&[u8]]],
    ) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.collateral_vault.to_account_info(),
            mint: self.collateral.to_account_info(),
            to: self.trader_collateral_account.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext {
            program: self.collateral_token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: pool_signer,
        };
        token_interface::transfer_checked(cpi_ctx, amount, self.collateral.decimals)
    }

    pub fn transfer_fees(&self, amount: u64, pool_signer: &[&[&[u8]]]) -> Result<()> {
        if self.pool.is_long_pool {
            let cpi_accounts = TransferChecked {
                from: self.trader_currency_account.to_account_info(),
                mint: self.currency.to_account_info(),
                to: self.fee_wallet.to_account_info(),
                authority: self.trader.to_account_info(),
            };
            let cpi_ctx = CpiContext {
                program: self.currency_token_program.to_account_info(),
                accounts: cpi_accounts,
                remaining_accounts: Vec::new(),
                signer_seeds: &[],
            };
            token_interface::transfer_checked(cpi_ctx, amount, self.currency.decimals)
        } else {
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
                signer_seeds: pool_signer,
            };
            token_interface::transfer_checked(cpi_ctx, amount, self.collateral.decimals)
        }
    }

    pub fn claim_position(&mut self) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        let interest_paid = self.debt_controller.compute_max_interest(
            self.position.principal,
            self.position.last_funding_timestamp,
            now,
        )?;

        let amount_owed = self
            .position
            .principal
            .checked_add(interest_paid)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        self.transfer_from_trader_to_vault(amount_owed)?;

        self.lp_vault.total_assets = self
            .lp_vault
            .total_assets
            .checked_add(interest_paid)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        let close_fee = self.position.fees_to_be_paid;

        let close_amounts = if self.pool.is_long_pool {
            self.transfer_from_collateral_vault_to_trader(
                self.position.collateral_amount,
                &[long_pool_signer_seeds!(self.pool)],
            )?;

            let close_amounts = CloseAmounts {
                payout: 0,
                collateral_spent: self.position.collateral_amount,
                interest_paid,
                principal_repaid: self.position.principal,
                past_fees: self.position.fees_to_be_paid,
                close_fee,
                liquidation_fee: 0,
            };

            self.transfer_fees(
                close_amounts.close_fee,
                &[long_pool_signer_seeds!(self.pool)],
            )?;

            close_amounts
        } else {
            let claim_amount = self
                .position
                .collateral_amount
                .checked_sub(close_fee)
                .ok_or(ErrorCode::ArithmeticOverflow)?;

            let close_amounts = CloseAmounts {
                payout: claim_amount,
                collateral_spent: self.position.collateral_amount,
                interest_paid,
                principal_repaid: self.position.principal,
                past_fees: self.position.fees_to_be_paid,
                close_fee,
                liquidation_fee: 0,
            };
            // pay out the collateral (claim_amount)
            self.transfer_from_collateral_vault_to_trader(
                claim_amount,
                &[short_pool_signer_seeds!(self.pool)],
            )?;

            // pay out the close fees
            self.transfer_fees(
                close_amounts.close_fee,
                &[short_pool_signer_seeds!(self.pool)],
            )?;

            close_amounts
        };

        emit!(PositionClaimed::new(
            &self.position,
            &close_amounts,
            self.pool.is_long_pool
        ));

        Ok(())
    }
}
