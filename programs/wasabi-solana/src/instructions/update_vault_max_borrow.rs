use {
    crate::{error::ErrorCode, LpVault, Permission},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct UpdateVaultMaxBorrow<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The key that has permission to init the vault
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
    )]
    pub permission: Account<'info, Permission>,

    #[account(mut)]
    pub lp_vault: Account<'info, LpVault>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateVaultMaxBorrowArgs {
    max_borrow: u64,
}

impl<'info> UpdateVaultMaxBorrow<'info> {
    pub fn validate(ctx: &Context<UpdateVaultMaxBorrow>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_init_vault(),
            ErrorCode::InvalidPermissions
        );
        Ok(())
    }

    pub fn update_lp_vault_max_borrow(&mut self, args: &UpdateVaultMaxBorrowArgs) -> Result<()> {
        self.lp_vault.max_borrow = args.max_borrow;
        Ok(())
    }
}