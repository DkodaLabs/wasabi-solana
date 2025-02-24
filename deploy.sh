#!/bin/bash

### RUN THIS SCRIPT AT THE PROJECT ROOT

# PROGRAM CONFIGURATION
PROGRAM_NAME="wasabi_solana"
PROGRAM_KEYPAIR_PATH="spicyTHtbmarmUxwFSHYpA8G4uP2nRNq38RReMpoZ9c.json"
DEPLOYMENT_KEYPAIR_PATH="/Users/a7rs/Projects/Dkoda/wasabi-solana/devnet-program-keypair.json" # REPLACE WITH THE PATH OF THE KEYPAIR THAT WILL DEPLOY THE PROGRAM AND BE THE PROGRAM'S UPDATE AUTHORITY
CLUSTER="devnet"

# PROGRAM PARAMETERS
SUPER_ADMIN="frae7AtwagcebTnNNFaobGH2haFUGNpFniKELbuBi2z" # PUBKEY OF THE NEW SUPER ADMIN
SUPER_ADMIN_KEYPAIR_PATH="$HOME/.config/solana/id1.json" # REPLACE WITH THE PATH TO THE PATH OF THE KEYPAIR FOR THE SUPER ADMIN
FEE_WALLET="frae7AtwagcebTnNNFaobGH2haFUGNpFniKELbuBi2z"
LIQUIDATION_WALLET="frae7AtwagcebTnNNFaobGH2haFUGNpFniKELbuBi2z"
MAX_APY=300 #300%
MAX_LEVERAGE=500 #5x
LIQUIDATION_FEE=5 #5%

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${YELLOW}[*] $1${NC}"
}

print_success() {
    echo -e "${GREEN}[+] $1${NC}"
}

print_error() {
    echo -e "${RED}[-] $1${NC}"
}

check_solana_config() {
    print_step "Checking Solana configuration..."

    if ! command -v solana &> /dev/null; then
        print_error "Solana CLI not found. Please install it first."
        exit 1
    fi
}

check_anchor() {
    print_step "Checking Anchor installation..."

    if ! command -v anchor &> /dev/null; then
        print_error "Anchor CLI not found. Please install it first."
        exit 1
    fi
}

check_wasabi_cli() {
    print_step "Checking Wasabi CLI installation..."

    if ! command -v wsb &> /dev/null; then
        print_error "Wasabi CLI not found. Please install it first."
        exit 1
    fi
}

check_files() {
    print_step "Checking required files..."

    if [ ! -f "$PROGRAM_KEYPAIR_PATH" ]; then
        print_error "Program keypair not found at $PROGRAM_KEYPAIR_PATH"
        exit 1
    fi

    if [ ! -f "$DEPLOYMENT_KEYPAIR_PATH" ]; then
        print_error "Deployment wallet not found at $DEPLOYMENT_KEYPAIR_PATH"
        exit 1
    fi
}

deploy_program() {
    print_step "Building program..."

    if ! anchor build; then
        print_error "Failed to build program"
        exit 1
    fi

    print_success "Build completed"

    print_step "Deploying program..."

        if ! anchor deploy \
        --program-name "$PROGRAM_NAME" \
        --program-keypair "$PROGRAM_KEYPAIR_PATH" \
        --provider.cluster "$CLUSTER" \
        --provider.wallet "$DEPLOYMENT_KEYPAIR_PATH"; then
        print_error "Failed to deploy program"
        exit 1
    fi

    print_success "Deployment completed"
}

set_program_config() {
    print_step "Initializing global settings..."
    if ! wsb -k "$DEPLOYMENT_KEYPAIR_PATH" \
        init-global-settings "$SUPER_ADMIN" "$FEE_WALLET" "$LIQUIDATION_WALLET"; then
        print_error "Failed to initialize global settings"
        exit 1
    fi

    print_success "Global settings initialized"

    print_step "Initializing debt controller..."
    if ! wsb -k "$SUPER_ADMIN_KEYPAIR_PATH" \
        init-debt-controller "$MAX_APY" "$MAX_LEVERAGE" "$LIQUIDATION_FEE"; then
        print_error "Failed to initialize debt controller"
        exit 1
    fi

    print_success "Debt controller initialized"
}

main() {
    check_files
    check_solana_config
    check_anchor
    check_wasabi_cli

    deploy_program

    set_program_config

    print_success "Deployment and initialization completed succesfully!"
}

main
