# Wasabi Solana

## Devnet deploy
1. Install dependencies
     - Install Solana CLI ([docs](https://docs.solanalabs.com/cli/install)) `sh -c "$(curl -sSfL https://release.solana.com/v1.18.18/install)"`
     - Install Anchor Version Manager ([docs](https://www.anchor-lang.com/docs/installation)) `cargo install --git https://github.com/coral-xyz/anchor avm --locked --force`
2. Create a keypair for deployment
    - Use the following command to create a simple paper wallet with no recovery seed `solana-keygen new -0 ~/wasabi-devnet-deployer.json --no-bip39-passphrase`
3. Build the program
    - Build: `anchor build`
4. Depoy the program
    - Deploy: `solana program deploy target/deploy/wasabi_solana.so --program-id $PWD/devnet-program-keypair.json --fee-payer ~/wasabi-devnet-deployer.json --keypair ~/wasabi-devnet-deployer.json --url devnet`
