import {
  AnchorProvider,
  Program,
  Wallet,
  web3,
  workspace,
} from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { createSimpleMint } from "./utils";
import {
  createAssociatedTokenAccountInstruction,
  createMintToCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

export let superAdminProgram: Program<WasabiSolana>;

export let tokenMintA: web3.PublicKey;
export let tokenMintB: web3.PublicKey;

export const mochaHooks = {
  beforeAll: async () => {
    const program = workspace.WasabiSolana as Program<WasabiSolana>;

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
    const tokenAKeypair = new web3.Keypair();
    tokenMintA = tokenAKeypair.publicKey;
    let { ixes: uIxes, mint: uMint } = await createSimpleMint(
      program.provider.publicKey,
      program.provider.connection,
      6,
      tokenAKeypair,
    );
    const tokenBKeypair = new web3.Keypair();
    tokenMintB = tokenBKeypair.publicKey;
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
      6
    );
    mintTx.add(mintToIx);
    await program.provider.sendAndConfirm(mintTx);
  },
};
