import * as anchor from "@coral-xyz/anchor";
import WasabiSolana from "../target/idl/wasabi_solana.json";
import { WasabiSolana as WasabiSolanaTypes } from "../target/types/wasabi_solana";
import {
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import fs from 'fs';
import dotenv from 'dotenv';
import { PublicKey } from "@solana/web3.js";

dotenv.config();

const main = async () => {
    console.log("Initializing vault...");

    const key = fs.readFileSync(process.env.DEVNET_KEYPAIR_FILE);
    const jsonKey = Buffer.from(JSON.parse(key.toString()));
    const keypair = anchor.web3.Keypair.fromSecretKey(jsonKey);
    const wallet = new anchor.Wallet(keypair);
    const connection = new anchor.web3.Connection("https://api.devnet.solana.com");

    const provider = new anchor.AnchorProvider(connection, wallet);
    const program = new anchor.Program(WasabiSolana as WasabiSolanaTypes, provider);

    const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            program.programId,
        );

    const tx = await program.methods
        .initLongPool()
        .accounts({
            payer: program.provider.publicKey,
            permission: superAdminPermissionKey,
            collateral: new PublicKey("8kEYsPTovQ4R5S5asTp18XZkSCgTsPnVZgVxrctA5p3X"),
            currency: new PublicKey("D1TTPYBrEoNejgBoMsg6hNgLMPRFUfiqqwmTz2k4XACF"),
            collateralTokenProgram: TOKEN_PROGRAM_ID,
            currencyTokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

    console.log("Vault initialized at ", tx);
}

main()
    .then(() => {
        console.log("Vault initialized successfully!");
        process.exit(0);
    })
    .catch(err => {
        console.error("Failed to run", err);
        process.exit(1);
    });

