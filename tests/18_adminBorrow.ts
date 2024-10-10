import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { NON_SWAP_AUTHORITY, SWAP_AUTHORITY, tokenMintA } from "./rootHooks";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { assert } from "chai";
import { getMultipleTokenAccounts } from "./utils";

describe("AdminBorrow", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  const [validPermission] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("admin"),
      NON_SWAP_AUTHORITY.publicKey.toBuffer(),
    ],
    program.programId
  );
  const [invalidPermission] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("admin"),
      SWAP_AUTHORITY.publicKey.toBuffer(),
    ],
    program.programId
  );
  const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
    program.programId
  );
  const ataTokenA = getAssociatedTokenAddressSync(
    tokenMintA,
    program.provider.publicKey,
    false
  );

  it("should fail without borrow permission", async () => {
    try {
      const lpVault = await program.account.lpVault.fetch(lpVaultKey);
      await program.methods
        .adminBorrow({ amount: new anchor.BN(10) })
        .accounts({
          authority: SWAP_AUTHORITY.publicKey,
          permission: invalidPermission,
          lpVault: lpVaultKey,
          vault: lpVault.vault,
          destination: ataTokenA,
        })
        .signers([SWAP_AUTHORITY])
        .rpc();
      throw new Error("should fail");
    } catch (err) {
      if (err instanceof anchor.AnchorError) {
        assert.equal(err.error.errorCode.number, 6000);
      } else {
        assert.ok(false);
      }
    }
  });

  it("should fail if exceeds max borrow", async () => {
    try {
      const lpVault = await program.account.lpVault.fetch(lpVaultKey);
      const amount = lpVault.maxBorrow.addn(1);
      await program.methods
        .adminBorrow({ amount })
        .accounts({
          authority: NON_SWAP_AUTHORITY.publicKey,
          permission: validPermission,
          lpVault: lpVaultKey,
          vault: lpVault.vault,
          destination: ataTokenA,
        })
        .signers([NON_SWAP_AUTHORITY])
        .rpc();
      throw new Error("should fail");
    } catch (err) {
      if (err instanceof anchor.AnchorError) {
        assert.equal(err.error.errorCode.number, 6018);
      } else {
        assert.ok(false);
      }
    }
  });

  it("should allow admin to borrow tokens", async () => {
    const amount = new anchor.BN(4);
    const lpVaultBefore = await program.account.lpVault.fetch(lpVaultKey);
    const [[vaultAccountBefore]] = await Promise.all([
      getMultipleTokenAccounts(program.provider.connection, [
        lpVaultBefore.vault,
      ]),
    ]);
    await program.methods
      .adminBorrow({ amount })
      .accounts({
        authority: NON_SWAP_AUTHORITY.publicKey,
        permission: validPermission,
        lpVault: lpVaultKey,
        vault: lpVaultBefore.vault,
        destination: ataTokenA,
      })
      .signers([NON_SWAP_AUTHORITY])
      .rpc();
    const [lpVaultAfter, [vaultAccountAfter]] = await Promise.all([
      program.account.lpVault.fetch(lpVaultKey),
      getMultipleTokenAccounts(program.provider.connection, [
        lpVaultBefore.vault,
      ]),
    ]);

    assert.equal(lpVaultAfter.totalBorrowed.toString(), amount.toString());
    assert.equal(
      vaultAccountAfter.amount,
      vaultAccountBefore.amount - BigInt(amount.toNumber())
    );
  });
});
