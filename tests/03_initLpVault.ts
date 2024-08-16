import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { superAdminProgram, tokenMintA } from "./rootHooks";

describe("InitLpVault", () => {
  it("should create the LP Vault", async () => {
    const [superAdminPermissionKey] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("super_admin")],
        superAdminProgram.programId,
      );
    await superAdminProgram.methods
      .initLpVault()
      .accounts({
        payer: superAdminProgram.provider.publicKey,
        permission: superAdminPermissionKey,
        assetMint: tokenMintA,
      })
      .rpc();
    const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
      superAdminProgram.programId,
    );
    const lpVaultAfter = await superAdminProgram.account.lpVault.fetch(
      lpVaultKey,
    );
    // TODO: write some validation tests
    assert.ok(false);
  });
});
