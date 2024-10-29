import * as anchor from "@coral-xyz/anchor";
import WasabiSolana from "../target/idl/wasabi_solana.json";
import { WasabiSolana as WasabiSolanaTypes } from "../target/types/wasabi_solana";
import { 
    MintLayout, 
    createInitializeMintInstruction, 
    TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
import fs from 'fs';
import dotenv from 'dotenv';
import { PublicKey } from "@solana/web3.js";

// @ts-ignore
const { BN } = anchor.default;

dotenv.config();

const mintKeypair = anchor.web3.Keypair.generate();
const createSimpleMint = async (
    payer: anchor.web3.PublicKey,
    connection: anchor.web3.Connection,
    decimals: number,
    programId: anchor.web3.PublicKey,
    mintKeypair?: anchor.web3.Keypair,
    lamps?: number,
    mintAuthority?: anchor.web3.PublicKey,
) => {
    let mint = mintKeypair ? mintKeypair : anchor.web3.Keypair.generate();
    let ixes: anchor.web3.TransactionInstruction[] = [];
    const lamports = lamps
        ? lamps
        : await connection.getMinimumBalanceForRentExemption(MintLayout.span);
    ixes.push(
        anchor.web3.SystemProgram.createAccount({
            fromPubkey: payer,
            newAccountPubkey: mint.publicKey,
            space: MintLayout.span,
            lamports: lamports,
            programId,
        }),
    );
    ixes.push(
        createInitializeMintInstruction(
            mint.publicKey,
            decimals,
            mintAuthority ?? payer,
            undefined,
            programId,
        ),
    );

    return { ixes, mint };
};


const main = async () => {
    console.log("Initializing vault...");

    const key = fs.readFileSync(process.env.DEVNET_KEYPAIR_FILE);
    const jsonKey = Buffer.from(JSON.parse(key.toString()));
    const keypair = anchor.web3.Keypair.fromSecretKey(jsonKey);
    const wallet = new anchor.Wallet(keypair);
    const connection = new anchor.web3.Connection("https://api.devnet.solana.com");

    const provider = new anchor.AnchorProvider(connection, wallet);
    const program = new anchor.Program(WasabiSolana as WasabiSolanaTypes, provider);

    const tx = new anchor.web3.Transaction();

    let { ixes: uIxes, mint: uMint } = await createSimpleMint(
        provider.publicKey,
        provider.connection,
        6,
        TOKEN_PROGRAM_ID,
        mintKeypair
    );

    tx.add(...uIxes);
    await program.provider.sendAndConfirm(tx, [uMint]);

    // TODO: Use wallet that has vault deployment permission
    const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            program.programId,
        );

    const tx2 = await program.methods
        .initLpVault({
            name: "sFAKEUSDC",
            symbol: "SFU",
            uri: "https://wasabi-public.s3.amazonaws.com/tokens/usdc.png",
        })
        .accounts({
            payer: program.provider.publicKey,
            permission: superAdminPermissionKey,
            assetMint: uMint.publicKey,
            assetTokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

    console.log("Vault initialized at ", tx2);
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
