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
```bash
curl https://sh.rustup.rs -sSf | sh
```
- Install Solana
```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"`
```
- Install Anchor Version Manager
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
```
- Install Anchor CLI
```bash
avm install latest
avm use@latest # Should use 0.30.1
```
- Install Wasabi Solana CLI
```bash
git clone git@github.com:DkodaLabs/wasabi-solana-cli.git
cd wasabi-solana-cli
cargo build --release && cargo install --path .
```
2. Ensure Solana and Anchor environment variables are set properly, `$XDG_DATA_HOME` on macOS refers to either `~/.local/share` or `~/Library/Application Support`
```bash
export AVM_HOME="$XDG_DATA_HOME/avm"
export AGAVE="$XDG_DATA_HOME/agave/target/debug"
export SOLANA_SDK_PATH="$XDG_DATA_HOME/solana/install/active_release/bin/solana/sdk"
export SOLANA_BIN_PATH="$XDG_DATA_HOME/solana/install/active_release/bin"
export PATH=$PATH:$AVM_HOME:$AGAVE:$SOLANA_SDK_PATH:$SOLANA_BIN_PATH
```
3. Change Rust default toolchain to be compatible with Anchor 
```bash
rustup default 1.79.0
rustup override set 1.79.0
```
4. Create the deployment/upgrade keypair and fund it with ~8 SOL. Also create the fee wallet and liquidation wallet keypairs
```bash
solana-keygen new --outfile deployer_keypair.json --no-bip39-passphrase
solana-keygen new --outfile fee_wallet_keypair.json --no-bip39-passphrase
solana-keygen new --outfile liquidation_wallet_keypair.json --no-bip39-passphrase
```
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
6. Run `deploy.sh` at the project root

## Program Configuration
All invocations follow the format:
```bash
wsb [OPTIONS] <COMMAND>
```
Options are:
- `-u/--url`: Target cluster
- `-k/--keypair`: The keypair that pays for the transaction and which the program will default to if no authority is provided with the command
- `-h/--help`: Self explanatory

1. Initialise fee & liquidation wallet associated token accounts
```bash
wsb init-ata <WALLET> <ASSET_MINT> <NUMBER_OF_WALLETS_TO_INIT>
```
Copy the output into the respective array in the `solana_coder/src/services/solana/transaction.ts` and repeat for each wallet and each asset mint

2. Initialise permissions
```bash
wsb -k [SUPER_ADMIN] admin <NEW_ADMIN> [FLAGS]
```
- `v`: grant vault initialisation permission
- `l`: grant liquidation permission
- `c`: grant swap co-sign permission
- `b`: grant borrow permission (will deprecate)
- `p`: grant pool initialisation permission

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
If both are present, the value passed to `-k/--keypair` will be the payer for the transaction and `-a/--authority` will be the super admin. If neither are present program defaults to client keypair in the solana config found at `$XDG_CONFIG_HOME/solana/id.json`.

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
wsb init-vault [OPTIONS] -n <NAME> -s <SYMBOL> -u <URI> <ASSET_MINT_PUBKEY>
```
Example:
```bash
wsb init-vault -a init_pool_keypair.json -n "Spicy SOL" -s "sSOL" -u "https://arweave.net/some_hash" So11111111111111111111111111111111111111111
```
The CLI will output any relevant addresses, these values may also be retrieved at any time using:
```bash
wsb vault asset So11111111111111111111111111111111111111111
```
or
```bash
wsb vault address <VAULT_ADDRESS>
```
NOTE: the keypair passed to `-k/--keypair` or `-a/--authority` must have the permission to init vaults. If neither are passed the program will default to the default keypair found at `$XDG_CONFIG_HOME/solana/id.json`

## Create Market
To create a market run:
1. Long
```bash
wsb init-pool [OPTIONS] long <CURRENCY> <COLLATERAL>
```
Example of a Solana mainnet long WIF/SOL market pool:
```bash
wsb init-pool -a pool_init_keypair.json long So11111111111111111111111111111111111111112 DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
```

2. Short
```bash
wsb init-pool [OPTIONS] short <CURRENCY> <COLLATERAL>
```
Example of a Solana mainnet short WIF/SOL market pool:
```bash
wsb init pool -a pool_init_keypair.json short DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 So11111111111111111111111111111111111111112
```
The CLI will output any relevant addresses, these values may also be retrieved at any time using:
```bash
wsb pool address <POOL_ADDRESS>
```
or
```bash
wsb pool mints <SIDE> <CURRENCY> <COLLATERAL>
```
The values for `<SIDE>` are:
- `long` 
- `short`

NOTE: the keypair passed to `-k/--keypair` or `-a/--authority` must have the permission to init vaults. If neither are passed the program will default to the default keypair found at `$XDG_CONFIG_HOME/solana/id.json`
