import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { superAdminProgram, tokenMintA, tokenMintB } from "./rootHooks";
import { WasabiSolana } from "../target/types/wasabi_solana";

describe("InitLongPool", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

  const [superAdminPermissionKey] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("super_admin")],
      program.programId,
    );

  it("should create the longPool", async () => {
    await superAdminProgram.methods
      .initLongPool()
      .accounts({
        payer: superAdminProgram.provider.publicKey,
        permission: superAdminPermissionKey,
        assetMint: tokenMintA,
      })
      .rpc();
    const [longPoolKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("long_pool"), tokenMintA.toBuffer()],
      superAdminProgram.programId,
    );
    const longPoolAfter = await superAdminProgram.account.basePool.fetch(longPoolKey);

    // Validate long pool was created
    assert.equal(longPoolAfter.collateral.toString(), tokenMintA.toString());
    assert.ok(longPoolAfter.isLongPool);
  });

  describe("non permissioned signer", () => {
    it("should fail", async () => {
      try {
        await program.methods
          .initLpVault()
          .accounts({
            payer: program.provider.publicKey,
            permission: superAdminPermissionKey,
            assetMint: tokenMintB,
          })
          .rpc();
        assert.ok(false);
      } catch (err) {
        if (err instanceof anchor.AnchorError) {
          assert.equal(err.error.errorCode.number, 2001);
        } else {
          assert.ok(false);
        }
      }
    });
  });
});
