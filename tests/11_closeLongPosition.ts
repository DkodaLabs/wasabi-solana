import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  abSwapKey,
  NON_SWAP_AUTHORITY,
  poolFeeAccount,
  poolMint,
  superAdminProgram,
  SWAP_AUTHORITY,
  swapTokenAccountA,
  swapTokenAccountB,
  TOKEN_SWAP_PROGRAM_ID,
  tokenMintA,
  tokenMintB,
} from "./rootHooks";
import { getMultipleTokenAccounts } from "./utils";
import { TokenSwap } from "@solana/spl-token-swap";

describe("CloseLongPosition", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  const [coSignerPermission] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("admin"),
      SWAP_AUTHORITY.publicKey.toBuffer(),
    ],
    program.programId,
  );
  const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
    program.programId,
  );
  const ownerTokenA = getAssociatedTokenAddressSync(
    tokenMintA,
    program.provider.publicKey,
    false,
  );
  const [longPoolBKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("long_pool"), tokenMintB.toBuffer()],
    program.programId,
  );
  const longPoolBVaultKey = getAssociatedTokenAddressSync(
    tokenMintB,
    longPoolBKey,
    true,
  );
  const closePositionRequestKey = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("long_pool"),
      program.provider.publicKey.toBuffer(),
    ],
    program.programId,
  );

  describe("With owned long position", () => {
    let positionKey: anchor.web3.PublicKey;
    let closeRequestExpiration = new anchor.BN(Date.now() / 1_000 + 60 * 60);
    before(async () => {
      const nonce = 0;
      [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("position"),
          program.provider.publicKey.toBuffer(),
          longPoolBKey.toBuffer(),
          lpVaultKey.toBuffer(),
          new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
        ],
        program.programId,
      );
    });
    it("should close the position and return funds", async () => {
      const positionBefore = await program.account.position.fetch(positionKey);
      const setupIx = await program.methods
        .closeLongPositionSetup({
          expiration: closeRequestExpiration,
          minTargetAmount: new anchor.BN(0),
        })
        .accounts({
          owner: program.provider.publicKey,
          ownerCurrencyAccount: ownerTokenA,
          longPool: longPoolBKey,
          position: positionKey,
          permission: coSignerPermission,
          // @ts-ignore
          authority: SWAP_AUTHORITY.publicKey,
        })
        .instruction();
      // TODO: swapIx
      await program.methods
        .closeLongPositionCleanup()
        .accounts({
          owner: program.provider.publicKey,
        })
        .preInstructions([setupIx])
        .signers([SWAP_AUTHORITY])
        .rpc();

      const positionAfter = await program.account.position.fetchNullable(
        positionKey,
      );
      assert.ok(positionAfter === null);
    });

    describe("with more than one setup IX", () => {
      it("should fail", async () => {
        try {
          const setupIx = await program.methods
            .closeLongPositionSetup({
              expiration: closeRequestExpiration,
              minTargetAmount: new anchor.BN(0),
            })
            .accounts({
              owner: program.provider.publicKey,
              ownerCurrencyAccount: ownerTokenA,
              longPool: longPoolBKey,
              position: positionKey,
              permission: coSignerPermission,
              // @ts-ignore
              authority: SWAP_AUTHORITY.publicKey,
            })
            .instruction();
          await program.methods
            .closeLongPositionCleanup()
            .accounts({
              owner: program.provider.publicKey,
            })
            .preInstructions([setupIx, setupIx])
            .signers([SWAP_AUTHORITY])
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
          await program.methods
            .closeLongPositionSetup({
              expiration: closeRequestExpiration,
              minTargetAmount: new anchor.BN(0),
            })
            .accounts({
              owner: program.provider.publicKey,
              ownerCurrencyAccount: ownerTokenA,
              longPool: longPoolBKey,
              position: positionKey,
              permission: coSignerPermission,
              // @ts-ignore
              authority: SWAP_AUTHORITY.publicKey,
            })
            .signers([SWAP_AUTHORITY])
            .rpc();
          assert.ok(false);
        } catch (err) {
          if (err instanceof anchor.AnchorError) {
            assert.equal(err.error.errorCode.number, 6002);
          } else {
            assert.ok(false);
          }
        }
      });
    });
  });
});
