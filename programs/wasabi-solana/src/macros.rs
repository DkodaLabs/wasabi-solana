#[macro_export]
macro_rules! lp_vault_signer_seeds {
    ($lp_vault:expr) => {
        &[
            b"lp_vault",
            $lp_vault.asset.as_ref(),
            &[$lp_vault.bump],
        ]
    };
}