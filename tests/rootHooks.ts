import {
  AnchorProvider,
  Program,
  Wallet,
  web3,
  workspace,
} from "@coral-xyz/anchor";
import { CurveType, TokenSwap } from "@solana/spl-token-swap";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { createSimpleMint } from "./utils";
import {
  AccountLayout,
  createAssociatedTokenAccountInstruction,
  createInitializeAccount3Instruction,
  createMintToCheckedInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export const TOKEN_SWAP_PROGRAM_ID = new web3.PublicKey(
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
);

export let superAdminProgram: Program<WasabiSolana>;

const tokenAKeypair = web3.Keypair.generate();
const tokenBKeypair = web3.Keypair.generate();

export const tokenMintA = tokenAKeypair.publicKey;
export const tokenMintB = tokenBKeypair.publicKey;

export let abSwapKey = web3.Keypair.generate();

export const mochaHooks = {
  beforeAll: async () => {
    const program = workspace.WasabiSolana as Program<WasabiSolana>;
    const lamportsForTokenAccount =
      await program.provider.connection.getMinimumBalanceForRentExemption(
        AccountLayout.span,
      );

    superAdminProgram = new Program(
      program.idl,
      new AnchorProvider(
        AnchorProvider.local().connection,
        new Wallet(web3.Keypair.generate()),
        { commitment: "processed" },
      ),
    );

    await superAdminProgram.provider.connection.requestAirdrop(
      superAdminProgram.provider.publicKey!,
      100_000_000_000,
    );

    const tx = new web3.Transaction();
    let { ixes: uIxes, mint: uMint } = await createSimpleMint(
      program.provider.publicKey,
      program.provider.connection,
      6,
      tokenAKeypair,
    );
    let { ixes: qIxes, mint: qMint } = await createSimpleMint(
      program.provider.publicKey,
      program.provider.connection,
      6,
      tokenBKeypair,
    );
    tx.add(...uIxes, ...qIxes);
    await program.provider.sendAndConfirm(tx, [uMint, qMint]);

    // Mint underlying & Quote to the provider wallet
    const mintTx = new web3.Transaction();
    const tokenAAta = await getAssociatedTokenAddress(
      tokenAKeypair.publicKey,
      program.provider.publicKey,
      false,
    );
    const createAtaIx = createAssociatedTokenAccountInstruction(
      program.provider.publicKey,
      tokenAAta,
      program.provider.publicKey,
      tokenAKeypair.publicKey,
    );
    mintTx.add(createAtaIx);
    const mintToIx = createMintToCheckedInstruction(
      tokenAKeypair.publicKey,
      tokenAAta,
      program.provider.publicKey,
      1_000_000_000 * Math.pow(10, 6),
      6,
    );
    mintTx.add(mintToIx);
    await program.provider.sendAndConfirm(mintTx);

    // TODO: Create a TokenSwap pool for the pair.
    const initSwapSetupIxs: web3.TransactionInstruction[] = [];
    const initSwapSetupSigners: web3.Signer[] = [];
    const [swapAuthority] = web3.PublicKey.findProgramAddressSync(
      [abSwapKey.publicKey.toBuffer()],
      TOKEN_SWAP_PROGRAM_ID,
    );
    const swapTokenAccountAKeypair = web3.Keypair.generate();
    initSwapSetupIxs.push(
      web3.SystemProgram.createAccount({
        fromPubkey: program.provider.publicKey,
        newAccountPubkey: swapTokenAccountAKeypair.publicKey,
        space: AccountLayout.span,
        lamports: lamportsForTokenAccount,
        programId: TOKEN_PROGRAM_ID,
      }),
    );
    initSwapSetupSigners.push(swapTokenAccountAKeypair);
    const initSwapTokenAccountAIx = createInitializeAccount3Instruction(
      swapTokenAccountAKeypair.publicKey,
      tokenMintA,
      swapAuthority,
    );
    initSwapSetupIxs.push(initSwapTokenAccountAIx);
    const swapTokenAccountBKeypair = web3.Keypair.generate();
    initSwapSetupIxs.push(
      web3.SystemProgram.createAccount({
        fromPubkey: program.provider.publicKey,
        newAccountPubkey: swapTokenAccountBKeypair.publicKey,
        space: AccountLayout.span,
        lamports: lamportsForTokenAccount,
        programId: TOKEN_PROGRAM_ID,
      }),
    );
    initSwapSetupSigners.push(swapTokenAccountBKeypair);
    const initSwapTokenAccountBIx = createInitializeAccount3Instruction(
      swapTokenAccountBKeypair.publicKey,
      tokenMintB,
      swapAuthority,
    );
    initSwapSetupIxs.push(initSwapTokenAccountBIx);
    let { ixes: initPoolMintIxes, mint: poolMint } = await createSimpleMint(
      program.provider.publicKey,
      program.provider.connection,
      6,
      undefined,
      undefined,
      swapAuthority,
    );
    initSwapSetupIxs.push(...initPoolMintIxes);
    initSwapSetupSigners.push(poolMint);
    const ownerPoolShareAta = await getAssociatedTokenAddress(
      poolMint.publicKey,
      program.provider.publicKey,
      false,
    );
    const createPoolShareAtaIx = createAssociatedTokenAccountInstruction(
      program.provider.publicKey,
      ownerPoolShareAta,
      program.provider.publicKey,
      poolMint.publicKey,
    );
    initSwapSetupIxs.push(createPoolShareAtaIx);

    const initSwapSetupTx = new web3.Transaction().add(...initSwapSetupIxs);
    console.log("swap pool setup");
    await program.provider.sendAndConfirm(initSwapSetupTx, initSwapSetupSigners);

    // TODO: Transfer initial tokens to the pool's tokenA and tokenB accounts

    const initPoolIx = TokenSwap.createInitSwapInstruction(
      abSwapKey,
      swapAuthority,
      swapTokenAccountAKeypair.publicKey,
      swapTokenAccountBKeypair.publicKey,
      poolMint.publicKey,
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
      CurveType.ConstantProduct,
    );
    const initSwapTx = new web3.Transaction().add(initPoolIx);
    console.log("initializing pool");
    await program.provider.sendAndConfirm(initSwapTx);
  },
};
