import * as anchor from "@coral-xyz/anchor";
import WasabiSolana from "../target/idl/wasabi_solana.json";
import { WasabiSolana as WasabiSolanaTypes } from "../target/types/wasabi_solana";
import { 
    TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
import fs from 'fs';
import dotenv from 'dotenv';
import { PublicKey } from "@solana/web3.js";

// @ts-ignore
const { BN } = anchor.default;

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

    const assetMint = new PublicKey("So11111111111111111111111111111111111111112");

    const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            program.programId,
        );

    const tx = await program.methods
        .initLpVault({
            name: "spicy wSOL",
            symbol: "swSOL",
            uri: "https://wasabi-public.s3.amazonaws.com/tokens/SOL.png",
        })
        .accounts({
            payer: program.provider.publicKey,
            permission: superAdminPermissionKey,
            assetMint: assetMint,
            assetTokenProgram: TOKEN_PROGRAM_ID,
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
