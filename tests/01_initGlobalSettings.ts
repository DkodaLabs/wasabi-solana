import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";

describe("wasabi-solana", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.WasabiSolana as Program<WasabiSolana>;

  it("Is initialized!", async () => {
    const tx = await program.methods
      .initGlobalSettings({
        feeWallet: program.provider.publicKey,
        statuses: 3,
      })
      .accounts({
        payer: program.provider.publicKey,
      })
      .rpc();
    console.log("Your transaction signature", tx);
  });
});
