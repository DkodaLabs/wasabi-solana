import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import { superAdminProgram } from "./rootHooks";

describe("setDebtControllerMaxLeverage", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  const [debtControllerKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("debt_controller")],
    program.programId,
  );

  it("should fail if not super admin", async () => {
    try {
      await program.methods.setMaxLeverage({
        maxLeverage: new anchor.BN(50),
      }).accounts({
        authority: program.provider.publicKey,
      }).rpc();
      assert.fail("Expected error");
    } catch (err) {
      if (err.message.includes("Expected error")) {
        assert.fail("Expected error");
        return
      }
      assert.ok(true);
    }
  });

  it("should set max leverage", async () => {
    const debtControllerBefore = await program.account.debtController.fetch(debtControllerKey);
    await superAdminProgram.methods.setMaxLeverage({
      maxLeverage: new anchor.BN(50),
    }).accounts({
      authority: superAdminProgram.provider.publicKey,
    }).rpc();
    const debtControllerAfter = await program.account.debtController.fetch(debtControllerKey);
    assert.equal(debtControllerAfter.maxLeverage.toNumber(), 50);
    assert.notEqual(debtControllerBefore.maxLeverage.toNumber(), debtControllerAfter.maxLeverage.toNumber());
  });
});