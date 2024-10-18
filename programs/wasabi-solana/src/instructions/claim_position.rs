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
        associated_token::token_program = token_program,
    )]
    pub trader_currency_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = collateral,
        associated_token::authority = trader,
        associated_token::token_program = token_program,
    )]
    pub trader_collateral_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        close = trader,
        has_one = trader,
        has_one = lp_vault,
        has_one = collateral,
    )]
    pub position: Box<Account<'info, Position>>,

    #[account(
        has_one = collateral,
        has_one = currency,
    )]
    pub pool: Account<'info, BasePool>,
    #[account(
        mut,
        associated_token::mint = collateral,
        associated_token::authority = pool,
        associated_token::token_program = token_program,
    )]
    pub collateral_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub collateral: InterfaceAccount<'info, Mint>,
    pub currency: InterfaceAccount<'info, Mint>,

    // The following three (3) addresses are dependent on whether the position is a long or short.
    // For example: If the position is long, we are borrowing the `currency` from the `lp_vault`
    // and thus the `vault` and the `fee_wallet` have the same mint as the `currency`.
    // If the position is short, we are borrowing the `collateral` from the `lp_vault` and thus the
    // `vault` and the `fee_wallet` have the same mint as the `collateral`
    //
    // This makes it difficult to infer the ATAs as Anchor does not permit conditionals in the
    // consraint. This is why we use the `vault` as a constraint to the `lp_vault` and why validation 
    // of the `fee_wallet` is done in the `validate` function.
    #[account(
        has_one = vault,
    )]
    pub lp_vault: Account<'info, LpVault>,

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

    pub token_program: Interface<'info, TokenInterface>,
}
impl<'info> ClaimPosition<'info> {
    pub fn validate(&self) -> Result<()> {
        require_keys_eq!(
            self.fee_wallet.owner,
            self.global_settings.protocol_fee_wallet,
            ErrorCode::IncorrectFeeWallet
        );
        Ok(())
    }

    pub fn transfer_from_trader_to_vault(&self, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.trader_currency_account.to_account_info(),
            mint: self.currency.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.trader.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
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
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: pool_signer,
        };
        token_interface::transfer_checked(cpi_ctx, amount, self.collateral.decimals)
    }

    pub fn transfer_fees(&self, amount: u64, pool_signer: &[&[&[u8]]]) -> Result<()> {
        let decimals: u8;
        let signers: &[&[&[u8]]];
        let cpi_accounts = if self.pool.is_long_pool {
            signers = &[];
            decimals = self.currency.decimals;
            TransferChecked {
                from: self.trader_currency_account.to_account_info(),
                mint: self.currency.to_account_info(),
                to: self.fee_wallet.to_account_info(),
                authority: self.trader.to_account_info(),
            }
        } else {
            signers = pool_signer;
            decimals = self.collateral.decimals;
            TransferChecked {
                from: self.collateral_vault.to_account_info(),
                mint: self.collateral.to_account_info(),
                to: self.fee_wallet.to_account_info(),
                authority: self.pool.to_account_info(),
            }
        };

        let cpi_ctx = CpiContext {
            program: self.token_program.to_account_info(),
            accounts: cpi_accounts,
            remaining_accounts: Vec::new(),
            signer_seeds: signers,
        };

        token_interface::transfer_checked(cpi_ctx, amount, decimals)
    }

    pub fn claim_position(&mut self) -> Result<()> {
        self.validate()?;
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
            .ok_or(ErrorCode::Overflow)?;

        self.transfer_from_trader_to_vault(amount_owed)?;

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
                .ok_or(ErrorCode::Overflow)?;
            let close_amounts = CloseAmounts {
                payout: claim_amount,
                collateral_spent: self.position.collateral_amount,
                interest_paid,
                principal_repaid: self.position.principal,
                past_fees: self.position.fees_to_be_paid,
                close_fee,
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

        emit!(PositionClaimed::new(&self.position, &close_amounts));

        Ok(())
    }
}

//#[derive(AnchorDeserialize, AnchorSerialize)]
//pub struct ClaimPositionArgs {}
//
//pub fn handler(ctx: Context<ClaimPosition>, _args: ClaimPositionArgs) -> Result<()> {
//    ctx.accounts.validate()?;
//    let now = Clock::get()?.unix_timestamp;
//
//    // Transfer the interest and principal
//    let position = &ctx.accounts.position;
//    let interest_paid = ctx.accounts.debt_controller.compute_max_interest(
//        position.principal,
//        position.last_funding_timestamp,
//        now,
//    )?;
//
//    let amount_owed = position
//        .principal
//        .checked_add(interest_paid)
//        .expect("overflow");
//    ctx.accounts.transfer_from_trader_to_vault(amount_owed)?;
//
//    let close_fee = position.fees_to_be_paid;
//
//    let close_amounts = if ctx.accounts.pool.is_long_pool {
//        // pay out the collateral (claim_amount)
//        ctx.accounts.transfer_from_collateral_vault_to_trader(
//            position.collateral_amount,
//            &[long_pool_signer_seeds!(ctx.accounts.pool)],
//        )?;
//
//        let close_amounts = CloseAmounts {
//            payout: 0,
//            collateral_spent: position.collateral_amount,
//            interest_paid,
//            principal_repaid: position.principal,
//            past_fees: position.fees_to_be_paid,
//            close_fee,
//        };
//        // pay out the close fees
//        ctx.accounts.transfer_fees(
//            close_amounts.close_fee,
//            &[long_pool_signer_seeds!(ctx.accounts.pool)],
//        )?;
//        close_amounts
//    } else {
//        let claim_amount = position.collateral_amount - close_fee;
//
//        let close_amounts = CloseAmounts {
//            payout: claim_amount,
//            collateral_spent: position.collateral_amount,
//            interest_paid,
//            principal_repaid: position.principal,
//            past_fees: position.fees_to_be_paid,
//            close_fee,
//        };
//        // pay out the collateral (claim_amount)
//        ctx.accounts.transfer_from_collateral_vault_to_trader(
//            claim_amount,
//            &[short_pool_signer_seeds!(ctx.accounts.pool)],
//        )?;
//
//        // pay out the close fees
//        ctx.accounts.transfer_fees(
//            close_amounts.close_fee,
//            &[short_pool_signer_seeds!(ctx.accounts.pool)],
//        )?;
//        close_amounts
//    };
//
//    // Emit the PositionClaimed event
//    emit!(PositionClaimed::new(position, &close_amounts));
//
//    Ok(())
//}
