import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { tokenMintA } from "./rootHooks";

describe("OpenLongPosition", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
    program.programId,
  );
  const ownerTokenA = getAssociatedTokenAddressSync(
    tokenMintA,
    program.provider.publicKey,
    false,
  );

  before(async () => {});

  describe("with more than one setup IX", () => {
    it("should fail", async () => {
      try {
        const setupIxBuilder = await program.methods
          .openLongPositionSetup({ minAmountOut: new anchor.BN(1_000) })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
          });
        const setupIx = await setupIxBuilder.instruction();
        await setupIxBuilder.preInstructions([setupIx]).rpc();
        assert.ok(false);
      } catch (err) {
        const regex = /already in use/;
        const match = err.toString().match(regex);
        if (match[0]) {
          assert.ok(true);
        } else {
          assert.ok(false);
        }
      }
    });
  });

  describe("without cleanup IX", () => {
    it("should fail", async () => {
      try {
        await program.methods
          .openLongPositionSetup({ minAmountOut: new anchor.BN(1_000) })
          .accounts({})
          .rpc();
      } catch (err) {
        if (err instanceof anchor.AnchorError) {
          assert.equal(err.error.errorCode.number, 6002);
        } else {
          assert.ok(false);
        }
      }
    });
  });

  describe("with one setup and one cleanup ", () => {
    it("should open a new position");
  });
});
