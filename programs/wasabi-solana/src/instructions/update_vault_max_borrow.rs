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

impl<'info> UpdateVaultMaxBorrow<'info> {
    pub fn validate(ctx: &Context<UpdateVaultMaxBorrow>) -> Result<()> {
        require!(
            ctx.accounts.permission.can_init_vault(),
            ErrorCode::InvalidPermissions
        );
        Ok(())
    }

    pub fn update_lp_vault_max_borrow(&mut self, max_borrow: u64) -> Result<()> {
        self.lp_vault.max_borrow = max_borrow;
        Ok(())
    }
}
