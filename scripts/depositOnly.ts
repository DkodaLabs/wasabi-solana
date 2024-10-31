import * as anchor from "@coral-xyz/anchor";
import WasabiSolana from "../../solana_coder/src/idl/wasabi_solana.json";
import { WasabiSolana as WasabiSolanaTypes } from "../../solana_coder/src/idl/wasabi_solana";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import fs from 'fs';
import dotenv from 'dotenv';
import { PublicKey } from "@solana/web3.js";

// @ts-ignore
const { BN } = anchor.default;

dotenv.config();

function getLpVault(mint: PublicKey, programId: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("lp_vault"),
            mint.toBuffer(),
        ],
        programId,
    )[0];
}

function getSharesMint(lpVault: PublicKey, asset: PublicKey, programId: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [
            lpVault.toBuffer(),
            asset.toBuffer(),
        ],
        programId,
    )[0];
}

const main = async () => {
    const key = fs.readFileSync(process.env.DEVNET_KEYPAIR_FILE);
    const jsonKey = Buffer.from(JSON.parse(key.toString()));
    const keypair = anchor.web3.Keypair.fromSecretKey(jsonKey);
    const wallet = new anchor.Wallet(keypair);
    const connection = new anchor.web3.Connection("https://api.devnet.solana.com");

    const provider = new anchor.AnchorProvider(connection, wallet);
    const program = new anchor.Program(WasabiSolana as WasabiSolanaTypes, provider);

    const mintAddress = new PublicKey("So11111111111111111111111111111111111111112");
    const lpVault = getLpVault(mintAddress, program.programId);

    const depositSig = await program.methods.deposit({ amount: new BN(1) }).accountsPartial({
        owner: program.provider.publicKey,
        lpVault: lpVault,
        vault: getAssociatedTokenAddressSync(mintAddress, lpVault, true, TOKEN_PROGRAM_ID),
        assetMint: mintAddress,
        sharesMint: getSharesMint(lpVault, mintAddress, program.programId),
        assetTokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();

    console.log("Deposit signature:", depositSig);
}

main()
    .then(() => {
        console.log("Deposit completed successfully!");
        process.exit(0);
    })
    .catch(err => {
        console.error("Failed to deposit:", err);
        process.exit(1);
    });
