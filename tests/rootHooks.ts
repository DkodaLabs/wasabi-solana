import { AnchorProvider, Program, Wallet, web3, workspace } from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";

export let superAdminProgram: Program<WasabiSolana>;

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
  }
}