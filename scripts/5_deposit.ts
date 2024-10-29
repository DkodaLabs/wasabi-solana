import * as anchor from "@coral-xyz/anchor";
import WasabiSolana from "../../solana_coder/src/idl/wasabi_solana.json";
import { WasabiSolana as WasabiSolanaTypes } from "../../solana_coder/src/idl/wasabi_solana";
import {
    MintLayout,
    createInitializeMintInstruction,
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
    createMintToCheckedInstruction,

} from "@solana/spl-token";
import fs from 'fs';
import dotenv from 'dotenv';
import { PublicKey } from "@solana/web3.js";

// @ts-ignore
const { BN } = anchor.default;

dotenv.config();

const mintKeypair = anchor.web3.Keypair.generate();
const mintKeypair2 = anchor.web3.Keypair.generate();

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

    let { ixes: tIxes, mint: tMint } = await createSimpleMint(
        provider.publicKey,
        provider.connection,
        6,
        TOKEN_PROGRAM_ID,
        mintKeypair2,
    );

    tx.add(...uIxes);
    tx.add(...tIxes);
    await program.provider.sendAndConfirm(tx, [uMint, tMint]);

    // TODO: Use wallet that has vault deployment permission
    const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            program.programId,
        );

    const tx2 = await program.methods
        .initLpVault({
            name: "spicy USD",
            symbol: "sUSD",
            uri: "https://wasabi-public.s3.amazonaws.com/tokens/usdc.png",
        })
        .accounts({
            payer: program.provider.publicKey,
            permission: superAdminPermissionKey,
            assetMint: uMint.publicKey,
            assetTokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    console.log("Init Vault:", tx2);

    const lpVaultA = getLpVault(uMint.publicKey, program.programId);

    const tx3 = await program.methods
        .initLpVault({
            name: "spicy SOL",
            symbol: "sSOL",
            uri: "https://wasabi-public.s3.amazonaws.com/tokens/SOL.png",
        }).accounts({
            payer: program.provider.publicKey,
            permission: superAdminPermissionKey,
            assetMint: tMint.publicKey,
            assetTokenProgram: TOKEN_PROGRAM_ID,
        }).rpc();
    console.log("Init Vault:", tx3);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    // Wait for confirmation
    await connection.confirmTransaction({
        signature: tx2,
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight
    });
    // Wait for confirmation
    await connection.confirmTransaction({
        signature: tx3,
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight
    });
    console.log("LP Vault:", lpVaultA.toString());
    console.log("Asset Mint:", uMint.publicKey.toString());

    const calculatedSharesMint = getSharesMint(lpVaultA, uMint.publicKey, program.programId);
    console.log("Calculated Shares Mint:", calculatedSharesMint.toString());

    const lpVaultB = getLpVault(tMint.publicKey, program.programId);

    // Mint underlying & Quote to the provider wallet
    const mintTx = new anchor.web3.Transaction();
    const ataTokenA = getAssociatedTokenAddressSync(
        uMint.publicKey,
        program.provider.publicKey,
        false,
    );
    const createAtaTokenAIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        ataTokenA,
        program.provider.publicKey,
        uMint.publicKey,
    );
    mintTx.add(createAtaTokenAIx);
    const ataTokenB = getAssociatedTokenAddressSync(
        tMint.publicKey,
        program.provider.publicKey,
        false,
    );
    const createAtaTokenBIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        ataTokenB,
        program.provider.publicKey,
        tMint.publicKey,
    );
    mintTx.add(createAtaTokenBIx);

    const mintTokenAToOwnerIx = createMintToCheckedInstruction(
        uMint.publicKey,
        ataTokenA,
        program.provider.publicKey,
        1_000_000_000 * Math.pow(10, 6),
        6,
        [],
        TOKEN_PROGRAM_ID,
    );
    mintTx.add(mintTokenAToOwnerIx);
    const mintTokenBToOwnerIx = createMintToCheckedInstruction(
        tMint.publicKey,
        ataTokenB,
        program.provider.publicKey,
        1_000_000_000 * Math.pow(10, 6),
        6,
        [],
        TOKEN_PROGRAM_ID,
    );
    mintTx.add(mintTokenBToOwnerIx);
    await program.provider.sendAndConfirm(mintTx);

    let shareTx = new anchor.web3.Transaction();
    const sharesA = getSharesMint(lpVaultA, mintKeypair.publicKey, program.programId);
    const sharesB = getSharesMint(lpVaultB, mintKeypair2.publicKey, program.programId);
    const ownerSharesAccountA = getAssociatedTokenAddressSync(
        sharesA,
        program.provider.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
    );
    const ownerSharesAccountB = getAssociatedTokenAddressSync(
        sharesB,
        program.provider.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
    );
    const ownerSharesAccountAIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        ownerSharesAccountA,
        program.provider.publicKey,
        sharesA,
        TOKEN_2022_PROGRAM_ID,
    );
    const ownerSharesAccountBIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        ownerSharesAccountB,
        program.provider.publicKey,
        sharesB,
        TOKEN_2022_PROGRAM_ID,
    );
    shareTx.add(ownerSharesAccountAIx);
    shareTx.add(ownerSharesAccountBIx);
    console.log("Share TX");

    await program.provider.sendAndConfirm(shareTx);

    const depositASig = await program.methods.deposit({ amount: new BN(1_000) }).accountsPartial({
        owner: program.provider.publicKey,
        lpVault: lpVaultA,
        vault: getAssociatedTokenAddressSync(uMint.publicKey, lpVaultA, true, TOKEN_PROGRAM_ID),
        assetMint: uMint.publicKey,
        sharesMint: getSharesMint(lpVaultA, uMint.publicKey, program.programId),
        assetTokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
    console.log("Deposit:", depositASig);

    const depositBSig = await program.methods.deposit({ amount: new BN(700) }).accountsPartial({
        owner: program.provider.publicKey,
        lpVault: lpVaultB,
        vault: getAssociatedTokenAddressSync(tMint.publicKey, lpVaultB, true, TOKEN_PROGRAM_ID),
        assetMint: tMint.publicKey,
        sharesMint: getSharesMint(lpVaultB, tMint.publicKey, program.programId),
        assetTokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
    console.log("Deposit:", depositBSig);

    const withdrawASig = await program.methods.withdraw({ amount: new BN(500) }).accountsPartial({
        owner: program.provider.publicKey,
        lpVault: lpVaultA,
        vault: getAssociatedTokenAddressSync(uMint.publicKey, lpVaultA, true, TOKEN_PROGRAM_ID),
        assetMint: uMint.publicKey,
        sharesMint: getSharesMint(lpVaultA, uMint.publicKey, program.programId),
        assetTokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
    console.log("Withdraw:", withdrawASig);

    const withdrawBSig = await program.methods.withdraw({ amount: new BN(300) }).accountsPartial({
        owner: program.provider.publicKey,
        lpVault: lpVaultB,
        vault: getAssociatedTokenAddressSync(tMint.publicKey, lpVaultB, true, TOKEN_PROGRAM_ID),
        assetMint: tMint.publicKey,
        sharesMint: getSharesMint(lpVaultB, tMint.publicKey, program.programId),
        assetTokenProgram: TOKEN_PROGRAM_ID
    }).rpc();
    console.log("Withdraw:", withdrawBSig);

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

