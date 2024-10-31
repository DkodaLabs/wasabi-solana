import * as anchor from "@coral-xyz/anchor";
import { 
    NATIVE_MINT,
    getAssociatedTokenAddressSync,
    createCloseAccountInstruction,
} from "@solana/spl-token";
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const main = async () => {
    const key = fs.readFileSync(process.env.DEVNET_KEYPAIR_FILE);
    const jsonKey = Buffer.from(JSON.parse(key.toString()));
    const keypair = anchor.web3.Keypair.fromSecretKey(jsonKey);
    const connection = new anchor.web3.Connection("https://api.devnet.solana.com");

    const wsolAccount = getAssociatedTokenAddressSync(
        NATIVE_MINT,
        keypair.publicKey,
        false,
    );

    const instructions = [
        createCloseAccountInstruction(
            wsolAccount,
            keypair.publicKey, // SOL return destination
            keypair.publicKey, // Authority
        )
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

    console.log(`Unwrapped SOL from account ${wsolAccount.toString()}`);
    console.log("Transaction signature:", signature);
}

main()
    .then(() => {
        console.log("SOL unwrapped successfully!");
        process.exit(0);
    })
    .catch(err => {
        console.error("Failed to unwrap SOL:", err);
        process.exit(1);
    });
