import * as anchor from "@coral-xyz/anchor";
import WasabiSolana from "../target/idl/wasabi_solana.json";
import { WasabiSolana as WasabiSolanaTypes } from "../target/types/wasabi_solana";
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const main = async () => {
    console.log("Initializing global settings...");

    const key = fs.readFileSync(process.env.DEVNET_KEYPAIR_FILE);
    const jsonKey = Buffer.from(JSON.parse(key.toString()));
    const keypair = anchor.web3.Keypair.fromSecretKey(jsonKey);
    const wallet = new anchor.Wallet(keypair);
    const connection = new anchor.web3.Connection("https://api.devnet.solana.com");
    
    const provider = new anchor.AnchorProvider(connection, wallet);
    const program = new anchor.Program(WasabiSolana as WasabiSolanaTypes, provider);
    
    // TODO: Update fee receiver wallet
    const newAuthority = null; // TODO: Add wallet for permissions

    const tx = await program.methods
        .initOrUpdatePermission({
            canCosignSwaps: true, // 4
            canInitVaults: true, // 1
            canLiquidate: true, // 2
            canBorrowFromVaults: true, // 8
            status: {active: {}}
        })
        .accounts({
            payer: program.provider.publicKey,
            newAuthority,
        })
        .rpc();

    console.log("Global settings initialized at ", tx);
}

main()
    .then(() => {
        console.log("Global settings initialized successfully!");
        process.exit(0);
    })
    .catch(err => {
        console.error("Failed to run", err);
        process.exit(1);
    });