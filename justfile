# Configuration
## CHANGE
wasabi_ts := env_var('HOME') + "/Projects/Dkoda/wasabi-solana-ts"

# Program Configuration
program_name := "wasabi_solana"
program_keypair := "spicyTHtbmarmUxwFSHYpA8G4uP2nRNq38RReMpoZ9c.json"
## CHANGE
deployment_keypair := env_var('HOME') + "/.config/solana/deploy.json"

# Program Parameters
## CHANGE
super_admin := "frae7AtwagcebTnNNFaobGH2haFUGNpFniKELbuBi2z"
## CHANGE
super_admin_keypair := env_var('HOME') + "/.config/solana/id.json"
fee_wallet := "frae7AtwagcebTnNNFaobGH2haFUGNpFniKELbuBi2z"
liquidation_wallet := "frae7AtwagcebTnNNFaobGH2haFUGNpFniKELbuBi2z"
max_apy := "300"
max_leverage := "300"
liquidation_fee := "5"

cluster := ""

set-cluster cluster:
    #!/usr/bin/env bash
    case "{{cluster}}" in
    "d"|"devnet") echo "devnet" > .cluster ;;
    "m"|"mainnet") echo "mainnet" > .cluster ;;
    "l"|"local"|"localnet") echo "localnet" > .cluster ;;
    *) echo "cluster" > .cluster
    esac

get-cluster:
    @cat .cluster

cluster-alias cluster:
    #!/usr/bin/env bash
    case "{{cluster}}" in
    "devnet") echo "d" ;;
    "mainnet") echo "m" ;;
    "localnet") echo "l" ;;
    *) echo "cluster"
    esac

default:
    @just --list

check-files:
    #!/usr/bin/env bash
    if [ ! -f "{{program_keypair}}" ]; then
        echo "Program keypair not found at {{program_keypair}}"
        exit 1
    fi
    if [ ! -f "{{deployment_keypair}}" ]; then
        echo "Deployment wallet not found at {{deployment_keypair}}"
        exit 1
    fi

check-solana:
    #!/usr/bin/env bash
    if ! command -v solana &> /dev/null; then
    echo "Solana CLI not found. Please install it first."
    exit 1
    fi

check-anchor:
    #!/usr/bin/env bash
    if ! command -v anchor &> /dev/null; then
    echo "Anchor CLI not found, Please install it first."
    exit 1
    fi

check-cli:
    #!/usr/bin/env bash
    if ! command -v wsb &> /dev/null; then
    echo "Wasabi CLI not found. Please install it first."
    exit 1
    fi

update-anchor-config CLUSTER:
    #!/usr/bin/env bash
    sed -i.bak "s/cluster = \".*\"/cluster = \"{{CLUSTER}}\"/" Anchor.toml
    rm Anchor.toml.bak

deploy C: check-files check-solana check-anchor
    #!/usr/bin/env bash
    just set-cluster {{C}}
    ALIAS=$(just cluster-alias $(just get-cluster))
    just update-anchor-config $(just get-cluster)
    solana config set -u "$ALIAS"

    echo "Building program..."
    anchor build

    echo "Deploying program..."
    anchor deploy \
        --program-name "{{program_name}}" \
        --program-keypair "{{program_keypair}}" \
        --provider.cluster "$(just get-cluster)" \
        --provider.wallet "{{deployment_keypair}}"

    sleep 5

global-settings:
    echo "Initializing global settings..."

    wsb -k "{{deployment_keypair}}" \
        init-global-settings "{{super_admin}}" "{{fee_wallet}}" "{{liquidation_wallet}}"

debt-controller:
    echo "Initializing debt controller"
    wsb -k "{{super_admin_keypair}}" \
        init-debt-controller "{{max_apy}}" "{{max_leverage}}" "{{liquidation_fee}}"

configure: check-cli global-settings debt-controller
    echo "Configuration successful!"

deploy-all CLUSTER: (deploy CLUSTER) configure
    echo "Deployment and initialization completed successfully!"

build-idl:
    anchor build
    cd programs/wasabi-solana
    anchor idl build --out {{wasabi_ts}}/src/idl/wasabi_solana.json --out-ts {{wasabi_ts}}/src/idl/wasabi_solana.ts

validator:
    solana-test-validator \
    --reset \
    --quiet \
    --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s tests/deps/token_metadata.so > validator.log 2>&1 &

    sleep 5
    echo "Validator started in background. Logs in validator.log"

stop-validator:
    pkill solana-test-validator || true
    echo "Validator stopped"

create-token:
    @solana-keygen new --no-bip39-passphrase --outfile "./temp.json" --force >/dev/null
    @spl-token create-token ./temp.json 2>/dev/null | grep "Address:" | awk '{print $2}'

configure-accounts:
    #!/usr/bin/env bash
    wsb admin "{{super_admin}}" -vlcpb
    token=$(just create-token)
    ata=$(spl-token create-account "$token")
    spl-token mint "$token" 1000000000 "$ata"
    echo "Token address A: $token"
    token2=$(just create-token)
    ata2=$(spl-token create-account "$token2")
    spl-token mint "$token2" 1000000000 "$ata2"
    echo "Token address B: $token2"
    wsb init-vault "$token" --name testSOL --symbol tSOL --uri https://solana.com
    wsb init-vault "$token2" --name testUSDC --symbol tUSDC --uri https://coingecko.com/usdc
    wsb init-market "$token2" "$token"
    wsb deposit "$token" 1000000 
    wsb deposit "$token2" 1000000

local-deploy: validator (deploy "localnet") configure

update C buffer_len="80000":
    #!/usr/bin/env bash
    just set-cluster {{C}}
    ALIAS=$(just cluster-alias $(just get-cluster))
    just update-anchor-config $(just get-cluster)
    solana config set -u "$ALIAS"

    echo "Building program..."
    anchor build

    # Get current program size and calculate new buffer length
    PROGRAM_ID=$(solana address -k {{program_keypair}})
    echo "Program ID: $PROGRAM_ID"
    CURRENT_LEN=$(solana program show $PROGRAM_ID --output json | jq '.dataLen')
    NEW_LEN=$(echo "($CURRENT_LEN * 100 + {{buffer_len}}) / 100" | bc)

    echo "Current length: $CURRENT_LEN"
    echo "New buffer length: $NEW_LEN"

    echo "Extending program buffer..."
    solana program extend $PROGRAM_ID $NEW_LEN

    echo "Updating program..."
    anchor deploy \
        --program-name "{{program_name}}" \
        --program-keypair "{{program_keypair}}" \
        --provider.cluster "$(just get-cluster)" \
        --provider.wallet "{{deployment_keypair}}" \

test suite:
    #!/usr/bin/env bash
    BASE_CMD="yarn run ts-mocha -p ./tsconfig.json -t 1000000"
    HOOK="tests/hooks/initWasabi.ts"
    ROOT_HOOK="tests/hooks/rootHook.ts"
    case "{{suite}}" in
    "setup")
        TEST_PATH="tests/01_setup-tests/*.ts"
        HOOK="$ROOT_HOOK"
        ;;
    "vaults")
        TEST_PATH="tests/02_vault-tests/*.ts"
        ;;
    "pools")
        TEST_PATH="tests/03_pool-tests/*.ts"
        ;;
    "trades")
        TEST_PATH="tests/04_trade-tests/*.ts"
        ;;
    "open-long")
        TEST_PATH="tests/04_trade-tests/10_openLongPosition.ts"
        ;;
    "open-short")
        TEST_PATH="tests/04_trade-tests/12_openShortPosition.ts"
        ;;
    "close-long")
        TEST_PATH="tests/04_trade-tests/11_closeLongPosition.ts"
        ;;
    "close-short")
        TEST_PATH="tests/04_trade-tests/13_closeShortPosition.ts"
        ;;
    "liquidations")
        TEST_PATH="tests/05_liquidation-tests/14_liquidate.ts"
        ;;
    "orders")
        TEST_PATH="tests/06_order-tests/*.ts"
        ;;
    "take-profit")
        TEST_PATH="tests/06_order-tests/15_takeProfit.ts"
        ;;
    "stop-loss")
        TEST_PATH="tests/06_order-tests/16_stopLoss.ts"
        ;;
    "strategies")
        TEST_PATH="tests/07_strategy-tests/*.ts"
        ;;
    "strategy-init")
        TEST_PATH="tests/07_strategy-tests/17_initStrategy.ts"
        ;;
    "strategy-deposit")
        TEST_PATH="tests/07_strategy-tests/18_strategyDeposit.ts"
        ;;
    "strategy-claim")
        TEST_PATH="tests/07_strategy-tests/19_strategyClaim.ts"
        ;;
    "strategy-withdraw")
        TEST_PATH="tests/07_strategy-tests/20_strategyWithdraw.ts"
        ;;
    "strategy-close")
        TEST_PATH="tests/07_strategy-tests/21_closeStrategy.ts"
        ;;
    *)
        TEST_PATH="tests/**/*.ts"
        HOOK="$ROOT_HOOK"
        ;;
    esac
    sed -i '' "s#test = \".*\"#test = \"$BASE_CMD $TEST_PATH --require $HOOK\"#" Anchor.toml
    sed -i '' 's#cluster = ".*#cluster = "localnet"#' Anchor.toml
    anchor test
