import * as anchor from "@coral-xyz/anchor";
import { tokenMintA } from "./rootHooks";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { assert } from "chai";
import { getMultipleTokenAccounts } from "./utils";

describe("Deposit", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  let lpVaultKey: anchor.web3.PublicKey;
  let lpVault: anchor.IdlAccounts<WasabiSolana>["lpVault"];
  let ownerSharesAccount: anchor.web3.PublicKey;
  before(async () => {
    [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
      program.programId,
    );
    lpVault = await program.account.lpVault.fetch(lpVaultKey);
    // Create the user's shares mint accounts
    const tx = new anchor.web3.Transaction();
    ownerSharesAccount = await getAssociatedTokenAddress(
      lpVault.sharesMint,
      program.provider.publicKey,
      false,
    );
    const createAtaIx = createAssociatedTokenAccountInstruction(
      program.provider.publicKey,
      ownerSharesAccount,
      program.provider.publicKey,
      lpVault.sharesMint,
    );
    tx.add(createAtaIx);
    await program.provider.sendAndConfirm(tx);
  });

  it("should create the LP Vault", async () => {
    const amount = new anchor.BN(1_000_000);
    const tokenAAta = await getAssociatedTokenAddress(
      tokenMintA,
      program.provider.publicKey,
      false,
    );
    const [ownerTokenABefore, vaultABefore] = await getMultipleTokenAccounts(
      program.provider.connection,
      [tokenAAta, lpVault.vault],
    );
    await program.methods
      .deposit({ amount })
      .accounts({
        owner: program.provider.publicKey,
        ownerAssetAccount: tokenAAta,
        ownerSharesAccount,
        lpVault: lpVaultKey,
      })
      .rpc();

    const [[ownerTokenAAfter, vaultAAfter], lpVaultAfter] = await Promise.all([
      getMultipleTokenAccounts(program.provider.connection, [
        tokenAAta,
        lpVault.vault,
      ]),
      program.account.lpVault.fetch(lpVaultKey),
    ]);

    // Validate tokens were transfered from the user's account to the vault
    const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
    assert.equal(-ownerADiff, BigInt(amount.toString()));
    const vaultADiff = vaultAAfter.amount - vaultABefore.amount;
    assert.equal(vaultADiff, BigInt(amount.toString()));

    // Validate the LpVault total assets was incremented properly
    const lpVaultAssetCountDiff = lpVaultAfter.totalAssets.sub(
      lpVault.totalAssets,
    );
    assert.equal(lpVaultAssetCountDiff.toString(), amount.toString());

    // TODO: Validate shares were minted to the user's account
    assert.ok(false);
  });
});
