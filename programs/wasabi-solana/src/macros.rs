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

#[macro_export]
macro_rules! long_pool_signer_seeds {
    ($long_pool:expr) => {
        &[
            b"long_pool",
            $long_pool.collateral.as_ref(),
            $long_pool.currency.as_ref(),
            &[$long_pool.bump],
        ]
    };
}