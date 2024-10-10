import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { tokenMintA } from "./rootHooks";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { assert } from "chai";
import { getMultipleTokenAccounts } from "./utils";

describe("Repay", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
    program.programId
  );
  const ataTokenA = getAssociatedTokenAddressSync(
    tokenMintA,
    program.provider.publicKey,
    false
  );

  it("should fail when repaying more than owed", async () => {
    const lpVaultBefore = await program.account.lpVault.fetch(lpVaultKey);
    try {
      await program.methods
        .repay({ amount: lpVaultBefore.totalBorrowed.addn(1) })
        .accounts({
          source: ataTokenA,
          lpVault: lpVaultKey,
          vault: lpVaultBefore.vault,
        })
        .rpc();
    } catch (err) {
      if (err instanceof anchor.AnchorError) {
        assert.equal(err.error.errorCode.number, 6019);
      } else {
        assert.ok(false);
      }
    }
  });

  it("should repay borrowed tokens from lp vault", async () => {
    const lpVaultBefore = await program.account.lpVault.fetch(lpVaultKey);
    const [vaultBefore] = await getMultipleTokenAccounts(
      program.provider.connection,
      [lpVaultBefore.vault]
    );
    await program.methods
      .repay({ amount: lpVaultBefore.totalBorrowed })
      .accounts({
        source: ataTokenA,
        lpVault: lpVaultKey,
        vault: lpVaultBefore.vault,
      })
      .rpc();
    const lpVaultAfter = await program.account.lpVault.fetch(lpVaultKey);
    const [vaultAfter] = await getMultipleTokenAccounts(
      program.provider.connection,
      [lpVaultBefore.vault]
    );
    assert.equal(lpVaultAfter.totalBorrowed.toNumber(), 0);
    assert.equal(
      vaultAfter.amount - vaultBefore.amount,
      BigInt(lpVaultBefore.totalBorrowed.toString())
    );
  });
});
