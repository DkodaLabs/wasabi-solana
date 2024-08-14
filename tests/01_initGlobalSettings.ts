import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";

describe("wasabi-solana", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.WasabiSolana as Program<WasabiSolana>;

  it("Is initialized!", async () => {
    const [globalSettingsKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("global_settings")],
      program.programId,
    );
    const tx = await program.methods
      .initGlobalSettings({
        feeWallet: program.provider.publicKey,
        statuses: 3,
      })
      .accounts({
        payer: program.provider.publicKey,
      })
      .rpc();
    const globalSettingsAfter = await program.account.globalSettings.fetch(globalSettingsKey);
    assert.equal(globalSettingsAfter.protocolFeeWallet.toString(), program.provider.publicKey.toString());
    assert.equal(globalSettingsAfter.statuses, 3);
  });
});
