use {
    crate::{
        error::ErrorCode,
        state::{GlobalSettings, Permission, ProtocolWallet},
    },
    anchor_lang::prelude::*,
    anchor_spl::{
        token_interface,
        token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked},
    },
};

#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = asset,
        associated_token::authority = authority,
        associated_token::token_program = token_program,
    )]
    pub authority_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(has_one = authority)]
    pub permission: Account<'info, Permission>,

    #[account(
        seeds = [b"global_settings"],
        bump,
    )]
    pub global_settings: Account<'info, GlobalSettings>,

    pub asset: InterfaceAccount<'info, Mint>,

    #[account(
        owner = crate::ID,
        seeds = [
            b"protocol_wallet",
            global_settings.key().as_ref(),
            &protocol_wallet.wallet_type.to_le_bytes(),
            &protocol_wallet.nonce.to_le_bytes(),
        ],
        bump = protocol_wallet.bump
    )]
    pub protocol_wallet: Account<'info, ProtocolWallet>,

    #[account(
        mut,
        associated_token::mint = asset,
        associated_token::authority = protocol_wallet,
        associated_token::token_program = token_program,
    )]
    pub protocol_wallet_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> CollectFees<'info> {
    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_manage_wallets(),
            ErrorCode::InvalidPermissions
        );

        Ok(())
    }

    pub fn collect_fees(&mut self) -> Result<()> {
        token_interface::transfer_checked(
            CpiContext {
                program: self.token_program.to_account_info(),
                accounts: TransferChecked {
                    from: self.protocol_wallet_ata.to_account_info(),
                    mint: self.asset.to_account_info(),
                    to: self.authority_ata.to_account_info(),
                    authority: self.protocol_wallet.to_account_info(),
                },

                remaining_accounts: Vec::new(),
                signer_seeds: &[&[
                    b"protocol_wallet",
                    self.global_settings.key().as_ref(),
                    &self.protocol_wallet.wallet_type.to_le_bytes(),
                    &self.protocol_wallet.nonce.to_le_bytes(),
                    &[self.protocol_wallet.bump],
                ]],
            },
            self.protocol_wallet_ata.amount,
            self.asset.decimals,
        )?;

        Ok(())
    }
}
