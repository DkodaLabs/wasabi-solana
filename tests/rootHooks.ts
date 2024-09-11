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
import { WasabiSolana } from "../target/types/wasabi_solana";
import { createSimpleMint } from "./utils";
import {
  AccountLayout,
  createAssociatedTokenAccountInstruction,
  createInitializeAccount3Instruction,
  createMintToCheckedInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export let superAdminProgram: Program<WasabiSolana>;

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
export const NON_SWAP_AUTHORITY = web3.Keypair.generate();
export const user2 = web3.Keypair.generate();

export const feeWalletKeyPair = web3.Keypair.generate();
export let feeWalletA: web3.PublicKey;
export let feeWalletB: web3.PublicKey;

export const mochaHooks = {
  beforeAll: async () => {
    const program = workspace.WasabiSolana as Program<WasabiSolana>;
    feeWalletA = getAssociatedTokenAddressSync(
      tokenMintA,
      feeWalletKeyPair.publicKey,
      false
    );
    feeWalletB = getAssociatedTokenAddressSync(
      tokenMintB,
      feeWalletKeyPair.publicKey,
      false
    );
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
    ]);

    const tx = new web3.Transaction();
    let { ixes: uIxes, mint: uMint } = await createSimpleMint(
      program.provider.publicKey,
      program.provider.connection,
      6,
      tokenAKeypair
    );
    let { ixes: qIxes, mint: qMint } = await createSimpleMint(
      program.provider.publicKey,
      program.provider.connection,
      6,
      tokenBKeypair
    );
    tx.add(...uIxes, ...qIxes);
    const createFeeWalletAtaAIx = createAssociatedTokenAccountInstruction(
      program.provider.publicKey,
      feeWalletA,
      feeWalletKeyPair.publicKey,
      tokenMintA,
    );
    tx.add(createFeeWalletAtaAIx);
    const createFeeWalletAtaBIx = createAssociatedTokenAccountInstruction(
      program.provider.publicKey,
      feeWalletB,
      feeWalletKeyPair.publicKey,
      tokenMintB,
    );    
    tx.add(createFeeWalletAtaBIx);
    await program.provider.sendAndConfirm(tx, [uMint, qMint]);

    // Mint underlying & Quote to the provider wallet
    const mintTx = new web3.Transaction();
    const ataTokenA = await getAssociatedTokenAddress(
      tokenAKeypair.publicKey,
      program.provider.publicKey,
      false
    );
    const createAtaTokanAIx = createAssociatedTokenAccountInstruction(
      program.provider.publicKey,
      ataTokenA,
      program.provider.publicKey,
      tokenAKeypair.publicKey
    );
    mintTx.add(createAtaTokanAIx);
    const ataTokenB = await getAssociatedTokenAddress(
      tokenBKeypair.publicKey,
      program.provider.publicKey,
      false
    );
    const createAtaTokanBIx = createAssociatedTokenAccountInstruction(
      program.provider.publicKey,
      ataTokenB,
      program.provider.publicKey,
      tokenBKeypair.publicKey
    );
    mintTx.add(createAtaTokanBIx);
    const mintTokenAToOwnerIx = createMintToCheckedInstruction(
      tokenAKeypair.publicKey,
      ataTokenA,
      program.provider.publicKey,
      1_000_000_000 * Math.pow(10, 6),
      6
    );
    mintTx.add(mintTokenAToOwnerIx);
    const mintTokenBToOwnerIx = createMintToCheckedInstruction(
      tokenBKeypair.publicKey,
      ataTokenB,
      program.provider.publicKey,
      1_000_000_000 * Math.pow(10, 6),
      6
    );
    mintTx.add(mintTokenBToOwnerIx);
    await program.provider.sendAndConfirm(mintTx);

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
      swapAuthority
    );
    initSwapSetupIxs.push(initSwapTokenAccountBIx);
    let { ixes: initPoolMintIxes, mint: _poolMint } = await createSimpleMint(
      program.provider.publicKey,
      program.provider.connection,
      6,
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
      false
    );
    poolFeeAccount = ownerPoolShareAta;
    const createPoolShareAtaIx = createAssociatedTokenAccountInstruction(
      program.provider.publicKey,
      ownerPoolShareAta,
      program.provider.publicKey,
      _poolMint.publicKey
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
      1_000_000_000
    );
    initSwapIxes.push(mintToPoolIxA);
    const mintToPoolIxB = createMintToInstruction(
      tokenMintB,
      swapTokenAccountBKeypair.publicKey,
      program.provider.publicKey,
      1_000_000_000
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
  },
};
