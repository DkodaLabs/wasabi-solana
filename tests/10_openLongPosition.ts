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
        const now = (new Date().getTime() / 1_000)
        const setupIx = await program.methods
          .openLongPositionSetup({
            minTargetAmount: new anchor.BN(1_900),
            downPayment: new anchor.BN(1_000),
            principal: new anchor.BN(1_000),
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600)
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
          })
          .instruction();
        await program.methods
          .openLongPositionCleanup()
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
          })
          .preInstructions([setupIx, setupIx])
          .rpc();
        assert.ok(false);
      } catch (err) {
        const regex = /already in use/;
        const match = err.toString().match(regex);
        if (match) {
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
        const now = (new Date().getTime() / 1_000)
        await program.methods
          .openLongPositionSetup({
            minTargetAmount: new anchor.BN(1_900),
            downPayment: new anchor.BN(1_000),
            principal: new anchor.BN(1_000),
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600)
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
          })
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