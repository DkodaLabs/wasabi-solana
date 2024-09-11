import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { superAdminProgram } from "./rootHooks";

describe("setDebtControllerMaxApy", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  const [debtControllerKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("debt_controller")],
    program.programId,
  );
  
  it("should fail without super admin", async () => {
    try {
      await program.methods.setMaxApy({
        maxApy: new anchor.BN(50),
      }).accounts({
        authority: program.provider.publicKey,
      }).rpc();
      assert.fail("Expected error");
    } catch (err) {
      if (err.message.includes("Expected error")) {
        assert.fail("Expected error");
        return;
      }
      assert.ok(true);
    }
  });

  it("should set max apy", async () => {
    const debtControllerBefore = await program.account.debtController.fetch(debtControllerKey);
    await superAdminProgram.methods.setMaxApy({
      maxApy: new anchor.BN(50),
    }).accounts({
      authority: superAdminProgram.provider.publicKey,
    }).rpc();
    const debtControllerAfter = await program.account.debtController.fetch(debtControllerKey);
    assert.equal(debtControllerAfter.maxApy.toNumber(), 50);
    assert.notEqual(debtControllerBefore.maxApy.toString(), debtControllerAfter.maxApy.toString());
  });
  
});