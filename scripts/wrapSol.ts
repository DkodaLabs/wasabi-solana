import * as anchor from "@coral-xyz/anchor";
import { 
    TOKEN_PROGRAM_ID,
    NATIVE_MINT,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
    createSyncNativeInstruction,
} from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const main = async () => {
    const key = fs.readFileSync(process.env.DEVNET_KEYPAIR_FILE);
    const jsonKey = Buffer.from(JSON.parse(key.toString()));
    const keypair = anchor.web3.Keypair.fromSecretKey(jsonKey);
    const connection = new anchor.web3.Connection("https://api.devnet.solana.com");

    const wrapAmount = 5;

    const wsolAccount = getAssociatedTokenAddressSync(
        NATIVE_MINT,
        keypair.publicKey,
        false,
        TOKEN_PROGRAM_ID
    );

    const instructions = [
        createAssociatedTokenAccountInstruction(
            keypair.publicKey,
            wsolAccount,
            keypair.publicKey,
            NATIVE_MINT,
            TOKEN_PROGRAM_ID
        ),
        anchor.web3.SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: wsolAccount,
            lamports: wrapAmount * LAMPORTS_PER_SOL,
        }),
        createSyncNativeInstruction(wsolAccount)
    ];

    const latestBlockhash = await connection.getLatestBlockhash();

    const messageV0 = new anchor.web3.TransactionMessage({
        payerKey: keypair.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions,
    }).compileToV0Message();

    const transaction = new anchor.web3.VersionedTransaction(messageV0);
    transaction.sign([keypair]);

    const signature = await connection.sendTransaction(transaction);

    await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    });

    console.log(`Wrapped ${wrapAmount} SOL to account ${wsolAccount.toString()}`);
    console.log("Transaction signature:", signature);
}

main()
    .then(() => {
        console.log("SOL wrapped successfully!");
        process.exit(0);
    })
    .catch(err => {
        console.error("Failed to wrap SOL:", err);
        process.exit(1);
    });
