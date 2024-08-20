import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { superAdminProgram, tokenMintA, tokenMintB } from "./rootHooks";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { WasabiSolana } from "../target/types/wasabi_solana";

describe("InitLpVault", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

  const [superAdminPermissionKey] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("super_admin")],
      program.programId,
    );

  it("should create the LP Vault", async () => {
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
    const [longPoolKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("long_pool"), tokenMintA.toBuffer()],
      superAdminProgram.programId,
    );
    const [shortPoolKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("short_pool"), tokenMintA.toBuffer()],
      superAdminProgram.programId,
    );
    const [sharesMint] = anchor.web3.PublicKey.findProgramAddressSync(
      [lpVaultKey.toBuffer(), tokenMintA.toBuffer()],
      superAdminProgram.programId,
    );
    const [lpVaultAfter, longPoolAfter, shortPoolAfter] = await Promise.all([
      superAdminProgram.account.lpVault.fetch(lpVaultKey),
      superAdminProgram.account.basePool.fetch(longPoolKey),
      superAdminProgram.account.basePool.fetch(shortPoolKey),
    ]);

    // Validate the LpVault state was set
    assert.equal(lpVaultAfter.totalAssets.toNumber(), 0);
    assert.equal(lpVaultAfter.asset.toString(), tokenMintA.toString());
    const vaultAddress = getAssociatedTokenAddressSync(
      tokenMintA,
      lpVaultKey,
      true,
    );
    assert.equal(lpVaultAfter.vault.toString(), vaultAddress.toString());
    assert.equal(lpVaultAfter.sharesMint.toString(), sharesMint.toString());

    // Validate long pool was created
    assert.equal(longPoolAfter.collateral.toString(), tokenMintA.toString());
    assert.ok(longPoolAfter.isLongPool);

    // Validate long pool was created
    assert.equal(shortPoolAfter.collateral.toString(), tokenMintA.toString());
    assert.ok(!shortPoolAfter.isLongPool);
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
