import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { superAdminProgram, tokenMintA, tokenMintB } from "./rootHooks";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

describe("InitShortPool", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

  const [superAdminPermissionKey] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("super_admin")],
      program.programId
    );

  it("should create the short pool", async () => {
    await superAdminProgram.methods
      .initShortPool()
      .accounts({
        payer: superAdminProgram.provider.publicKey,
        permission: superAdminPermissionKey,
        assetMint: tokenMintA,
        currencyMint: tokenMintB,
      })
      .rpc();
    const [shortPoolKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("short_pool"),
        tokenMintA.toBuffer(),
        tokenMintB.toBuffer(),
      ],
      superAdminProgram.programId
    );
    const collateralVaultKey = getAssociatedTokenAddressSync(
      tokenMintA,
      shortPoolKey,
      true
    );
    const currencyVaultKey = getAssociatedTokenAddressSync(
      tokenMintB,
      shortPoolKey,
      true
    );
    const [shortPoolAfter, collateralVault, currencyVault] = await Promise.all([
      superAdminProgram.account.basePool.fetch(shortPoolKey),
      program.provider.connection.getAccountInfo(collateralVaultKey),
      program.provider.connection.getAccountInfo(currencyVaultKey),
    ]);

    // Validate short pool was created
    assert.equal(shortPoolAfter.collateral.toString(), tokenMintA.toString());
    assert.equal(
      shortPoolAfter.collateralVault.toString(),
      collateralVaultKey.toString()
    );
    assert.equal(shortPoolAfter.currency.toString(), tokenMintB.toString());
    assert.equal(
      shortPoolAfter.currencyVault.toString(),
      currencyVaultKey.toString()
    );
    assert.isNotNull(collateralVault);
    assert.isNotNull(currencyVault);
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
