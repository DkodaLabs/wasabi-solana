import * as anchor from "@coral-xyz/anchor";
import WasabiSolana from "../target/idl/wasabi_solana.json";
import { WasabiSolana as WasabiSolanaTypes } from "../target/types/wasabi_solana";
import fs from 'fs';
import dotenv from 'dotenv';

// @ts-ignore
const { BN } = anchor.default;

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

    const maxApy = new BN(300);      // 300% APR
    const maxLeverage = new BN(500); // 5x leverage

    const tx = await program.methods.initDebtController({
        maxApy,
        maxLeverage,
      }).accounts({
        superAdmin: program.provider.publicKey,
      }).rpc();

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