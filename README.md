# Wasabi Solana

## Devnet deploy
1. Install dependencies
     - Install Solana CLI ([docs](https://docs.solanalabs.com/cli/install)) `sh -c "$(curl -sSfL https://release.solana.com/v1.18.18/install)"`
     - Install Anchor Version Manager ([docs](https://www.anchor-lang.com/docs/installation)) `cargo install --git https://github.com/coral-xyz/anchor avm --locked --force`
2. Create a keypair for deployment
    - Use the following command to create a simple paper wallet with no recovery seed `solana-keygen new -0 ./devnet-program-deployer.json --no-bip39-passphrase`
3. Build the program
    - Build: `anchor build`
4. Depoy the program
    - Deploy: `solana program deploy target/deploy/wasabi_solana.so --program-id $PWD/devnet-program-keypair.json --fee-payer ./devnet-program-deployer.json --keypair ./devnet-program-deployer.json --url devnet`

## Mainnet Deployment
1. Install dependencies
    - Install Rust
    - Install Cargo
    - Install Solana
    - Install Anchor Version Manager
    - Install Anchor CLI
    - Install Wasabi Solana CLI
2. Ensure Solana and Anchor environment variables are set properly
3. Change Rust default toolchain to be compatible with Anchor 
4. Create the deployment and upgrade keypair and fund it with ~8 SOL.
5. Edit `deploy.sh`
    - Change `DEPLOYMENT_WALLET_PATH` to point to the keypair 
    - Change `CLUSTER` to `mainnet-beta`
    - Change `SUPER_ADMIN` to the PUBLIC KEY that will be the super admin
    - Change `SUPER_ADMIN_KEYPAIR_PATH` to the path of the keypair that is the `SUPER_ADMIN`
    - Change `MAX_APY` to the desired maximum apy for the platform - this can be changed later
    - Change `MAX_LEVERAGE` to the desired maximum leverage for the platform - this can be changed later
    - Change `LIQUIDATION_FEE` to the desired percentage of the down payment to be charged for liquidations
6. Run `deploy.sh`

## Program Configuration
Once the program is deployed, we must setup the fee and liquidation wallets as well as setup permissions for any additional wallets
