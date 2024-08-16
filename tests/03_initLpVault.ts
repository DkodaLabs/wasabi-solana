import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { superAdminProgram, tokenMintA } from "./rootHooks";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

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
    const [sharesMint] = anchor.web3.PublicKey.findProgramAddressSync(
      [lpVaultKey.toBuffer(), tokenMintA.toBuffer()],
      superAdminProgram.programId,
    );
    const lpVaultAfter = await superAdminProgram.account.lpVault.fetch(
      lpVaultKey,
    );

    // Validate the LpVault state was set
    assert.equal(lpVaultAfter.totalAssets.toNumber(), 0);
    assert.equal(lpVaultAfter.asset.toString(), tokenMintA.toString());
    const vaultAddress = getAssociatedTokenAddressSync(tokenMintA, lpVaultKey, true);
    assert.equal(lpVaultAfter.vault.toString(), vaultAddress.toString());
    assert.equal(lpVaultAfter.sharesMint.toString(), sharesMint.toString());
  });
});
