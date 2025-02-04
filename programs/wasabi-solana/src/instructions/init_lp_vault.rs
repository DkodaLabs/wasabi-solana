use {
    crate::{error::ErrorCode, events::NewVault, LpVault, Permission},
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::AssociatedToken,
        metadata::Metadata,
        token_interface::{Mint, Token2022, TokenAccount, TokenInterface},
    },
    mpl_token_metadata::{
        instructions::CreateCpiBuilder,
        types::{CreateArgs, TokenStandard},
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
    pub permission: Box<Account<'info, Permission>>,

    #[account(
        init,
        payer = payer,
        seeds = [b"lp_vault", asset_mint.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<LpVault>(),
    )]
    pub lp_vault: Box<Account<'info, LpVault>>,

    pub asset_mint: Box<InterfaceAccount<'info, Mint>>,

    // Due to stack frame limit we should init the `lp_vault`'s ata beforehand
    #[account(
        associated_token::mint = asset_mint,
        associated_token::authority = lp_vault,
        associated_token::token_program = asset_token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payer,
        seeds = [lp_vault.key().as_ref(), asset_mint.key().as_ref()],
        bump,
        mint::authority = lp_vault,
        mint::decimals = asset_mint.decimals,
        mint::token_program = shares_token_program,
    )]
    pub shares_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK
    #[account(mut)]
    pub shares_metadata: AccountInfo<'info>,

    pub asset_token_program: Interface<'info, TokenInterface>,
    pub shares_token_program: Program<'info, Token2022>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    /// CHECK: required by metadata program
    pub sysvar_instructions: AccountInfo<'info>,
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

        let shares_metadata_address = Pubkey::find_program_address(
            &[
                b"metadata",
                ctx.accounts.token_metadata_program.key().as_ref(),
                ctx.accounts.shares_mint.key().as_ref(),
            ],
            &ctx.accounts.token_metadata_program.key(),
        )
        .0;

        require_keys_eq!(
            ctx.accounts.shares_metadata.key(),
            shares_metadata_address,
            ErrorCode::InvalidMetadata
        );
        Ok(())
    }

    fn initialize_token_metadata(
        &self,
        args: &InitLpVaultArgs,
        bumps: &InitLpVaultBumps,
    ) -> Result<()> {
        let args = CreateArgs::V1 {
            name: args.name.clone(),
            symbol: args.symbol.clone(),
            uri: args.uri.clone(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
            primary_sale_happened: false,
            is_mutable: true,
            token_standard: TokenStandard::Fungible,
            collection_details: None,
            rule_set: None,
            decimals: Some(self.asset_mint.decimals),
            print_supply: None,
        };

        CreateCpiBuilder::new(&self.token_metadata_program.to_account_info())
            .metadata(&self.shares_metadata.to_account_info())
            .mint(&self.shares_mint.to_account_info(), false)
            .authority(&self.lp_vault.to_account_info())
            .payer(&self.payer.to_account_info())
            .update_authority(&self.authority.to_account_info(), true)
            .system_program(&self.system_program)
            .sysvar_instructions(&self.sysvar_instructions.to_account_info())
            .spl_token_program(Some(&self.shares_token_program.to_account_info()))
            .create_args(args)
            .invoke_signed(&[&[
                b"lp_vault",
                self.asset_mint.key().as_ref(),
                &[bumps.lp_vault],
            ]])?;

        Ok(())
    }

    pub fn init_lp_vault(
        &mut self,
        args: &InitLpVaultArgs,
        bumps: &InitLpVaultBumps,
    ) -> Result<()> {
        self.initialize_token_metadata(&args, bumps)?;

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
