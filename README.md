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
    - Change `FEE_WALLET` to the public key of the wallet to receive fees
    - Change `LIQUIDATION_WALLET` to the public key of the wallet to receive liquidation fees
    - Change `MAX_APY` to the desired maximum apy for the platform - this can be changed later
    - Change `MAX_LEVERAGE` to the desired maximum leverage for the platform - this can be changed later
    - Change `LIQUIDATION_FEE` to the desired percentage of the down payment to be charged for liquidations
6. Run `deploy.sh`

## Program Configuration
1. Initialise fee & liquidation wallet associated token accounts
    - `wsb init-ata <WALLET> <ASSET_MINT> <NUMBER_OF_WALLETS_TO_INIT>`
    - Copy the output into the respective array in the `solana_coder/src/services/solana/transaction.ts`
    - Repeat for each wallet and each asset mint
2. Initialise permissions
    - `wsb -k [SUPER_ADMIN] admin <NEW_ADMIN> [FLAGS]
        - 'v': grant vault initialisation permission
        - 'l': grant liquidation permission
        - 'c': grant swap co-sign permission
        - 'b': grant borrow permission (will deprecate)
        - 'p': grant pool initialisation permission

Example for coder transaction permission (liquidation and swap co-sign):
```bash
wsb -k keypair.json admin <PUBKEY> -lc
```

Example for market opening permissions (init vault & init pool):
```bash
wsb -k keypair.json admin <PUBKEY> -pv
```

## Change Super Admin
To change the super admin run the following with the super admin keypair:
```bash
wsb set-super-admin [OPTIONS] <NEW_SUPER_ADMIN_PUBKEY>
```
NOTE: the super admin keypair can be passed in with `-k/--keypair` before the command or `-a/--authority` as an option. 
If both are present, the value passed to `-k/--keypair` will be the payer for the transaction and `-a/--authority` will be the super admin. If neither are present program defaults to client keypair in the solana config.

## Create Vaults
1. Create the LP Token metadata, this should have the following format:
```json
{
  "name": "Spicy SOL",
  "symbol": "sSOL",
  "description": "The LP token for the Wasabi protocol's SOL vault",
  "image": "https://arweave.net/[METADATA_HASH]",
  "creators": {
    "name": "Wasabi Protcol",
    "site": "https://wasabi.xyz"
  }
}
```
2. Upload this metadata and its image
3. Run:
```bash
wsb -k keypair.json init-vault -n <NAME> -s <SYMBOL> -u <URI> <ASSET_MINT_PUBKEY>
```
Example:
```bash
wsb -k keypair.json init-vault -n "Spicy SOL" -s "sSOL" -u "https://arweave.net/some_hash" So11111111111111111111111111111111111111111
```
The CLI will output any relevant addresses, these values may also be retrieved at any time using:
```bash
wsb vault asset So11111111111111111111111111111111111111111
wsb vault vault <VAULT_ADDRESS>
```
NOTE: the keypair passed to -k or -a must have the permission to init vaults. If neither are passed the program will default to the default keypair found at `$XDG_CONFIG_HOME/solana/id.json`

## Create Market
To create a market run:
1. Long
```bash
wsb -k keypair init-pool [OPTIONS] long <CURRENCY> <COLLATERAL>
```

2. Short
```bash
wsb -k keypair init-pool [OPTIONS] short <CURRENCY> <COLLATERAL>
```
NOTE: the keypair passed to -k or -a must have the permission to init vaults. If neither are passed the program will default to the default keypair found at `$XDG_CONFIG_HOME/solana/id.json`
