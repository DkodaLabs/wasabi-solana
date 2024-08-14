pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("DVmp8rZQHYSAo2h2SsXERvd85ks8wNUvfw33jLVWc2DX");

#[program]
pub mod wasabi_solana {
    use super::*;

    pub fn init_global_settings(ctx: Context<InitGlobalSettings>, args: InitGlobalSettingsArgs) -> Result<()> {
        init_global_settings::handler(ctx, args)
    }
}
