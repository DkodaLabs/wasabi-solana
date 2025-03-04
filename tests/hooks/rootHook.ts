import {
    AnchorProvider,
    Program,
    utils,
    Wallet,
    web3,
    workspace,
} from "@coral-xyz/anchor";
import {
    CurveType,
    TOKEN_SWAP_PROGRAM_ID,
    TokenSwap,
    TokenSwapLayout,
} from "@solana/spl-token-swap";
import { WasabiSolana } from "../../target/types/wasabi_solana";
import { createSimpleMint } from "../utils";
import {
    AccountLayout,
    createAssociatedTokenAccountInstruction,
    createInitializeAccount3Instruction,
    createMintToCheckedInstruction,
    createMintToInstruction,
    getAssociatedTokenAddress,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

export const WASABI_PROGRAM_ID = new web3.PublicKey("spicyTHtbmarmUxwFSHYpA8G4uP2nRNq38RReMpoZ9c");

export let superAdminProgram: Program<WasabiSolana>;
export const [superAdminPermission] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("super_admin")],
    WASABI_PROGRAM_ID
)

export const tokenAKeypair = web3.Keypair.generate();
export const tokenBKeypair = web3.Keypair.generate();
const swapTokenAccountAKeypair = web3.Keypair.generate();
const swapTokenAccountBKeypair = web3.Keypair.generate();

export const tokenMintA = tokenAKeypair.publicKey;
export const tokenMintB = tokenBKeypair.publicKey;


export const abSwapKey = web3.Keypair.generate();
export const swapTokenAccountA = swapTokenAccountAKeypair.publicKey;
export const swapTokenAccountB = swapTokenAccountBKeypair.publicKey;
export let poolMint: web3.PublicKey;
export let poolFeeAccount: web3.PublicKey;

export const SWAP_AUTHORITY = web3.Keypair.generate();
/** Can liquidate AND init vaults */
export const NON_SWAP_AUTHORITY = web3.Keypair.generate();
export const CAN_SWAP_CANT_LIQ_AUTH = web3.Keypair.generate();
export const NON_BORROW_AUTHORITY = web3.Keypair.generate();
export const BORROW_AUTHORITY = web3.Keypair.generate();
export const user2 = web3.Keypair.generate();

export const feeWalletKeypair = web3.Keypair.generate();
export const liquidationWalletKeypair = web3.Keypair.generate();

export let openPosLut: web3.PublicKey;

export let globalSettingsKey: web3.PublicKey;

export const [lpVaultA] = web3.PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
    WASABI_PROGRAM_ID
);

export const vaultA = getAssociatedTokenAddressSync(
    tokenMintA,
    lpVaultA,
    true,
    TOKEN_PROGRAM_ID
);

export const [lpVaultB] = web3.PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("lp_vault"), tokenMintB.toBuffer()],
    WASABI_PROGRAM_ID
);

export const vaultB = getAssociatedTokenAddressSync(
    tokenMintB,
    lpVaultB,
    true,
    TOKEN_PROGRAM_ID
);

export const [coSignerPermission] = web3.PublicKey.findProgramAddressSync(
    [
        utils.bytes.utf8.encode("admin"),
        SWAP_AUTHORITY.publicKey.toBuffer(),
    ],
    WASABI_PROGRAM_ID
);

export const feeWalletA = getAssociatedTokenAddressSync(
    tokenMintA,
    feeWalletKeypair.publicKey,
    true,
    TOKEN_PROGRAM_ID
);

export const feeWalletB = getAssociatedTokenAddressSync(
    tokenMintB,
    feeWalletKeypair.publicKey,
    true,
    TOKEN_PROGRAM_ID
);

export const liquidationWalletA = getAssociatedTokenAddressSync(
    tokenMintA,
    liquidationWalletKeypair.publicKey,
    true,
    TOKEN_PROGRAM_ID
);

export const liquidationWalletB = getAssociatedTokenAddressSync(
    tokenMintB,
    liquidationWalletKeypair.publicKey,
    true,
    TOKEN_PROGRAM_ID
);

export const mochaHooks = {
    beforeAll: async () => setupTestEnvironment(),
};

export const setupTestEnvironment = async () => {
    const program = workspace.WasabiSolana as Program<WasabiSolana>;
    const lamportsForTokenAccount =
        await program.provider.connection.getMinimumBalanceForRentExemption(
            AccountLayout.span
        );
    const lamportsForTokenSwapAccount =
        await program.provider.connection.getMinimumBalanceForRentExemption(
            TokenSwapLayout.span
        );

    superAdminProgram = new Program(
        program.idl,
        new AnchorProvider(
            AnchorProvider.local().connection,
            new Wallet(web3.Keypair.generate()),
            { commitment: "processed" }
        )
    );

    await Promise.all([
        superAdminProgram.provider.connection.requestAirdrop(
            superAdminProgram.provider.publicKey!,
            100_000_000_000
        ),
        superAdminProgram.provider.connection.requestAirdrop(
            user2.publicKey,
            100_000_000_000
        ),
        superAdminProgram.provider.connection.requestAirdrop(
            SWAP_AUTHORITY.publicKey,
            100_000_000_000
        ),
        superAdminProgram.provider.connection.requestAirdrop(
            NON_SWAP_AUTHORITY.publicKey,
            100_000_000_000
        ),
        superAdminProgram.provider.connection.requestAirdrop(
            NON_BORROW_AUTHORITY.publicKey,
            100_000_000_000
        ),
        superAdminProgram.provider.connection.requestAirdrop(
            BORROW_AUTHORITY.publicKey,
            100_000_000_000
        )
    ]);

    const tx = new web3.Transaction();
    let { ixes: uIxes, mint: uMint } = await createSimpleMint(
        program.provider.publicKey,
        program.provider.connection,
        6,
        TOKEN_PROGRAM_ID,
        tokenAKeypair
    );
    let { ixes: qIxes, mint: qMint } = await createSimpleMint(
        program.provider.publicKey,
        program.provider.connection,
        6,
        TOKEN_PROGRAM_ID,
        tokenBKeypair
    );
    tx.add(...uIxes, ...qIxes);
    await program.provider.sendAndConfirm(tx, [uMint, qMint]);

    // Mint underlying & Quote to the provider wallet
    const mintTx = new web3.Transaction();
    const ataTokenA = getAssociatedTokenAddressSync(
        tokenAKeypair.publicKey,
        program.provider.publicKey,
        false,
        TOKEN_PROGRAM_ID,
    );
    const createAtaTokenAIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        ataTokenA,
        program.provider.publicKey,
        tokenAKeypair.publicKey,
        TOKEN_PROGRAM_ID,
    );
    mintTx.add(createAtaTokenAIx);
    const ataTokenB = getAssociatedTokenAddressSync(
        tokenBKeypair.publicKey,
        program.provider.publicKey,
        false,
        TOKEN_PROGRAM_ID,
    );
    const createAtaTokenBIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        ataTokenB,
        program.provider.publicKey,
        tokenBKeypair.publicKey,
        TOKEN_PROGRAM_ID,
    );
    mintTx.add(createAtaTokenBIx);
    const mintTokenAToOwnerIx = createMintToCheckedInstruction(
        tokenAKeypair.publicKey,
        ataTokenA,
        program.provider.publicKey,
        1_000_000_000 * Math.pow(10, 6),
        6,
        [],
        TOKEN_PROGRAM_ID,
    );
    mintTx.add(mintTokenAToOwnerIx);
    const mintTokenBToOwnerIx = createMintToCheckedInstruction(
        tokenBKeypair.publicKey,
        ataTokenB,
        program.provider.publicKey,
        1_000_000_000 * Math.pow(10, 6),
        6,
        [],
        TOKEN_PROGRAM_ID,
    );
    mintTx.add(mintTokenBToOwnerIx);
    await program.provider.sendAndConfirm(mintTx);
    // Mint to user2
    const mintUser2Tx = new web3.Transaction();
    const user2AtaTokenA = getAssociatedTokenAddressSync(
        tokenAKeypair.publicKey,
        user2.publicKey,
        false,
        TOKEN_PROGRAM_ID,
    );
    const createUser2AtaTokanAIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        user2AtaTokenA,
        user2.publicKey,
        tokenAKeypair.publicKey,
        TOKEN_PROGRAM_ID,
    );
    mintUser2Tx.add(createUser2AtaTokanAIx);
    const user2AtaTokenB = getAssociatedTokenAddressSync(
        tokenBKeypair.publicKey,
        user2.publicKey,
        false,
        TOKEN_PROGRAM_ID,
    );
    const createUser2AtaTokanBIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        user2AtaTokenB,
        user2.publicKey,
        tokenBKeypair.publicKey,
        TOKEN_PROGRAM_ID,
    );
    mintUser2Tx.add(createUser2AtaTokanBIx);
    const mintTokenAToUser2Ix = createMintToCheckedInstruction(
        tokenAKeypair.publicKey,
        user2AtaTokenA,
        program.provider.publicKey,
        1_000_000_000 * Math.pow(10, 6),
        6,
        [],
        TOKEN_PROGRAM_ID,
    );
    mintUser2Tx.add(mintTokenAToUser2Ix);
    const mintTokenBToUser2Ix = createMintToCheckedInstruction(
        tokenBKeypair.publicKey,
        user2AtaTokenB,
        program.provider.publicKey,
        1_000_000_000 * Math.pow(10, 6),
        6,
        [],
        TOKEN_PROGRAM_ID,
    );
    mintUser2Tx.add(mintTokenBToUser2Ix);
    await program.provider.sendAndConfirm(mintUser2Tx);

    // Create a TokenSwap pool for the pair.
    const initSwapSetupIxs: web3.TransactionInstruction[] = [];
    const initSwapSetupSigners: web3.Signer[] = [];
    const [swapAuthority] = web3.PublicKey.findProgramAddressSync(
        [abSwapKey.publicKey.toBuffer()],
        TOKEN_SWAP_PROGRAM_ID
    );
    initSwapSetupIxs.push(
        web3.SystemProgram.createAccount({
            fromPubkey: program.provider.publicKey,
            newAccountPubkey: swapTokenAccountAKeypair.publicKey,
            space: AccountLayout.span,
            lamports: lamportsForTokenAccount,
            programId: TOKEN_PROGRAM_ID,
        })
    );
    initSwapSetupSigners.push(swapTokenAccountAKeypair);
    const initSwapTokenAccountAIx = createInitializeAccount3Instruction(
        swapTokenAccountAKeypair.publicKey,
        tokenMintA,
        swapAuthority
    );
    initSwapSetupIxs.push(initSwapTokenAccountAIx);
    initSwapSetupIxs.push(
        web3.SystemProgram.createAccount({
            fromPubkey: program.provider.publicKey,
            newAccountPubkey: swapTokenAccountBKeypair.publicKey,
            space: AccountLayout.span,
            lamports: lamportsForTokenAccount,
            programId: TOKEN_PROGRAM_ID,
        })
    );
    initSwapSetupSigners.push(swapTokenAccountBKeypair);
    const initSwapTokenAccountBIx = createInitializeAccount3Instruction(
        swapTokenAccountBKeypair.publicKey,
        tokenMintB,
        swapAuthority,
        TOKEN_PROGRAM_ID,
    );
    initSwapSetupIxs.push(initSwapTokenAccountBIx);
    let { ixes: initPoolMintIxes, mint: _poolMint } = await createSimpleMint(
        program.provider.publicKey,
        program.provider.connection,
        6,
        TOKEN_PROGRAM_ID,
        undefined,
        undefined,
        swapAuthority
    );
    poolMint = _poolMint.publicKey;
    initSwapSetupIxs.push(...initPoolMintIxes);
    initSwapSetupSigners.push(_poolMint);
    const ownerPoolShareAta = await getAssociatedTokenAddress(
        _poolMint.publicKey,
        program.provider.publicKey,
        false,
        TOKEN_PROGRAM_ID,
    );
    poolFeeAccount = ownerPoolShareAta;
    const createPoolShareAtaIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        ownerPoolShareAta,
        program.provider.publicKey,
        _poolMint.publicKey,
        TOKEN_PROGRAM_ID,
    );
    initSwapSetupIxs.push(createPoolShareAtaIx);

    const initSwapSetupTx = new web3.Transaction().add(...initSwapSetupIxs);
    await program.provider.sendAndConfirm(
        initSwapSetupTx,
        initSwapSetupSigners
    );

    // TODO: Transfer initial tokens to the pool's tokenA and tokenB accounts
    const initSwapIxes: web3.TransactionInstruction[] = [];
    const mintToPoolIxA = createMintToInstruction(
        tokenMintA,
        swapTokenAccountAKeypair.publicKey,
        program.provider.publicKey,
        1_000_000_000,
        [],
        TOKEN_PROGRAM_ID,
    );
    initSwapIxes.push(mintToPoolIxA);
    const mintToPoolIxB = createMintToInstruction(
        tokenMintB,
        swapTokenAccountBKeypair.publicKey,
        program.provider.publicKey,
        1_000_000_000,
        [],
        TOKEN_PROGRAM_ID,
    );
    initSwapIxes.push(mintToPoolIxB);
    initSwapIxes.push(
        web3.SystemProgram.createAccount({
            fromPubkey: program.provider.publicKey,
            newAccountPubkey: abSwapKey.publicKey,
            space: TokenSwapLayout.span,
            lamports: lamportsForTokenSwapAccount,
            programId: TOKEN_SWAP_PROGRAM_ID,
        })
    );

    const initPoolIx = TokenSwap.createInitSwapInstruction(
        abSwapKey,
        swapAuthority,
        swapTokenAccountAKeypair.publicKey,
        swapTokenAccountBKeypair.publicKey,
        _poolMint.publicKey,
        ownerPoolShareAta,
        ownerPoolShareAta,
        TOKEN_PROGRAM_ID,
        TOKEN_SWAP_PROGRAM_ID,
        BigInt(100),
        BigInt(10_000),
        BigInt(0),
        BigInt(10_000),
        BigInt(0),
        BigInt(10_000),
        BigInt(0),
        BigInt(10_000),
        CurveType.ConstantProduct
    );
    initSwapIxes.push(initPoolIx);
    const initSwapTx = new web3.Transaction().add(...initSwapIxes);
    await program.provider.sendAndConfirm(initSwapTx, [abSwapKey]);

    const provider = AnchorProvider.local();
    const slot = await provider.connection.getSlot();

    const [createLookupTableIx, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: provider.publicKey,
            payer: provider.publicKey,
            recentSlot: slot,
        });
    openPosLut = lookupTableAddress;

    [globalSettingsKey] = web3.PublicKey.findProgramAddressSync(
        [utils.bytes.utf8.encode("global_settings")],
        program.programId,
    );
    const [lpVaultAKey] = web3.PublicKey.findProgramAddressSync(
        [utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
        superAdminProgram.programId,
    );
    const [lpVaultBKey] = web3.PublicKey.findProgramAddressSync(
        [utils.bytes.utf8.encode("lp_vault"), tokenMintB.toBuffer()],
        superAdminProgram.programId,
    );

    const [debtControllerKey] = web3.PublicKey.findProgramAddressSync(
        [utils.bytes.utf8.encode("debt_controller")],
        superAdminProgram.programId,
    );

    const feeWalletAccountA = getAssociatedTokenAddressSync(
        tokenMintA,
        feeWalletKeypair.publicKey,
        true,
        TOKEN_PROGRAM_ID
    );

    const feeWalletAccountB = getAssociatedTokenAddressSync(
        tokenMintB,
        feeWalletKeypair.publicKey,
        true,
        TOKEN_PROGRAM_ID
    );

    const liquidationWalletAccountA = getAssociatedTokenAddressSync(
        tokenMintA,
        liquidationWalletKeypair.publicKey,
        true,
        TOKEN_PROGRAM_ID
    );

    const liquidationWalletAccountB = getAssociatedTokenAddressSync(
        tokenMintB,
        liquidationWalletKeypair.publicKey,
        true,
        TOKEN_PROGRAM_ID
    );

    const protocolWalletsTx = new web3.Transaction();

    const createFeeWalletAtaA = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        feeWalletAccountA,
        feeWalletKeypair.publicKey,
        tokenMintA,
        TOKEN_PROGRAM_ID,
    );
    protocolWalletsTx.add(createFeeWalletAtaA);

    const createFeeWalletAtaB = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        feeWalletAccountB,
        feeWalletKeypair.publicKey,
        tokenMintB,
        TOKEN_PROGRAM_ID,
    );
    protocolWalletsTx.add(createFeeWalletAtaB);

    const createLiqWalletAtaA = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        liquidationWalletAccountA,
        liquidationWalletKeypair.publicKey,
        tokenMintA,
        TOKEN_PROGRAM_ID,
    );
    protocolWalletsTx.add(createLiqWalletAtaA);

    const createLiqWalletAtaB = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,
        liquidationWalletAccountB,
        liquidationWalletKeypair.publicKey,
        tokenMintB,
        TOKEN_PROGRAM_ID,
    );
    protocolWalletsTx.add(createLiqWalletAtaB);
    await program.provider.sendAndConfirm(protocolWalletsTx);

    const extendLookupTableIx =
        web3.AddressLookupTableProgram.extendLookupTable({
            authority: provider.publicKey,
            payer: provider.publicKey,
            lookupTable: lookupTableAddress,
            addresses: [
                // General keys
                debtControllerKey,
                globalSettingsKey,
                feeWalletKeypair.publicKey,
                liquidationWalletKeypair.publicKey,
                lpVaultAKey,
                lpVaultBKey,
                feeWalletAccountA,
                feeWalletAccountB,
                liquidationWalletAccountA,
                liquidationWalletAccountB,
                tokenMintA,
                tokenMintB,
                swapTokenAccountA,
                swapTokenAccountB,
                SWAP_AUTHORITY.publicKey,
                NON_SWAP_AUTHORITY.publicKey,
                TOKEN_PROGRAM_ID,
                SYSTEM_PROGRAM_ID,
                TOKEN_SWAP_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
                web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            ],
        });
    const _tx = new web3.Transaction()
        .add(createLookupTableIx)
        .add(extendLookupTableIx);
    await provider.sendAndConfirm(_tx, [], { skipPreflight: true });
};
