use {
    crate::{error::ErrorCode, events::NewVault, LpVault, Permission},
    anchor_lang::{
        prelude::*,
        solana_program::{program::invoke, system_instruction::transfer},
    },
    anchor_spl::{
        associated_token::AssociatedToken,
        token_interface::{
            token_metadata_initialize, Mint, Token2022, TokenAccount, TokenInterface,
            TokenMetadataInitialize,
        },
    },
};

#[derive(Accounts)]
pub struct InitLpVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The key that has permission to init the vault
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
    )]
    pub permission: Account<'info, Permission>,

    #[account(
        init,
        payer = payer,
        seeds = [b"lp_vault", asset_mint.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<LpVault>(),
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,

    pub asset_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = asset_mint,
        associated_token::authority = lp_vault,
        associated_token::token_program = asset_token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = payer,
        seeds = [lp_vault.key().as_ref(), asset_mint.key().as_ref()],
        bump,
        mint::authority = lp_vault,
        mint::decimals = asset_mint.decimals,
        mint::token_program = shares_token_program,
        extensions::metadata_pointer::authority = lp_vault,
        extensions::metadata_pointer::metadata_address = shares_mint,
    )]
    pub shares_mint: Box<InterfaceAccount<'info, Mint>>,

    pub asset_token_program: Interface<'info, TokenInterface>,

    pub shares_token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitLpVaultArgs {
    name: String,
    symbol: String,
    uri: String,
}

impl<'info> InitLpVault<'info> {
    pub fn validate(ctx: &Context<InitLpVault>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_init_vault(),
            ErrorCode::InvalidPermissions
        );
        Ok(())
    }

    fn initialize_token_metadata(
        &self,
        args: &InitLpVaultArgs,
        bumps: &InitLpVaultBumps,
    ) -> Result<()> {
        let cpi_accounts = TokenMetadataInitialize {
            token_program_id: self.shares_token_program.to_account_info(),
            mint: self.shares_mint.to_account_info(),
            metadata: self.shares_mint.to_account_info(),
            mint_authority: self.lp_vault.to_account_info(),
            update_authority: self.authority.to_account_info(),
        };

        token_metadata_initialize(
            CpiContext::new_with_signer(
                self.shares_token_program.to_account_info(),
                cpi_accounts,
                &[&[
                    b"lp_vault",
                    self.asset_mint.key().as_ref(),
                    &[bumps.lp_vault],
                ]],
            ),
            args.name.clone(),
            args.symbol.clone(),
            args.uri.clone(),
        )?;

        Ok(())
    }

    pub fn init_lp_vault(
        &mut self,
        args: &InitLpVaultArgs,
        bumps: &InitLpVaultBumps,
    ) -> Result<()> {
        self.initialize_token_metadata(&args, bumps)?;

        update_account_lamports_to_minimum_balance(
            self.shares_mint.to_account_info(),
            self.payer.to_account_info(),
            self.system_program.to_account_info(),
        )?;

        self.lp_vault.set_inner(LpVault {
            bump: bumps.lp_vault,
            asset: self.asset_mint.key(),
            vault: self.vault.key(),
            shares_mint: self.shares_mint.key(),
            total_assets: 0,
            total_borrowed: 0,
            max_borrow: 0,
        });

        emit!(NewVault::new(&self.lp_vault));

        Ok(())
    }
}
pub fn update_account_lamports_to_minimum_balance<'info>(
    account: AccountInfo<'info>,
    payer: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
) -> Result<()> {
    let extra_lamports = Rent::get()?.minimum_balance(account.data_len()) - account.get_lamports();
    if extra_lamports > 0 {
        invoke(
            &transfer(payer.key, account.key, extra_lamports),
            &[payer, account, system_program],
        )?;
    }
    Ok(())
}
