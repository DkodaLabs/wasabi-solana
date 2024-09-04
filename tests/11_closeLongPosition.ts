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
  tokenMintA,
  tokenMintB,
  user2,
} from "./rootHooks";
import { getMultipleTokenAccounts } from "./utils";
import { TOKEN_SWAP_PROGRAM_ID, TokenSwap } from "@solana/spl-token-swap";

describe.skip("CloseLongPosition", () => {
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

    // should fail when position is not owned by current signer/owner
    describe("Incorrect owner", () => {
      it("should fail", async () => {
        const positionBefore = await program.account.position.fetch(
          positionKey,
        );
        const setupIx = await program.methods
          .closeLongPositionSetup({
            expiration: closeRequestExpiration,
            minTargetAmount: new anchor.BN(0),
            interest: new anchor.BN(10),
          })
          .accounts({
            owner: user2.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            longPool: longPoolBKey,
            position: positionKey,
            permission: coSignerPermission,
            // @ts-ignore
            authority: SWAP_AUTHORITY.publicKey,
          })
          .instruction();
        const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
          [abSwapKey.publicKey.toBuffer()],
          TOKEN_SWAP_PROGRAM_ID,
        );
        const swapIx = TokenSwap.swapInstruction(
          abSwapKey.publicKey,
          swapAuthority,
          program.provider.publicKey,
          longPoolBVaultKey,
          swapTokenAccountB,
          swapTokenAccountA,
          ownerTokenA,
          poolMint,
          poolFeeAccount,
          null,
          tokenMintB,
          tokenMintA,
          TOKEN_SWAP_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          BigInt(positionBefore.collateralAmount.toString()),
          BigInt(0),
        );
        try {
          await program.methods
            .closeLongPositionCleanup()
            .accounts({
              owner: user2.publicKey,
              ownerCurrencyAccount: ownerTokenA,
              longPool: longPoolBKey,
              position: positionKey,
              lpVault: lpVaultKey,
            })
            .preInstructions([setupIx, swapIx])
            .signers([SWAP_AUTHORITY, user2])
            .rpc();
        } catch (err) {
          if (err instanceof anchor.AnchorError) {
            assert.equal(err.error.errorCode.number, 6010);
          } else if (err instanceof anchor.ProgramError) {
            assert.equal(err.code, 6010);
          } else {
            assert.ok(false);
          }
        }
      });
    });

    // should fail if not signed by co-signer with swap authority
    describe("Without swap co-signer", () => {
      it("Should fail", async () => {
        const positionBefore = await program.account.position.fetch(
          positionKey,
        );
        const [badCoSignerPermission] =
          anchor.web3.PublicKey.findProgramAddressSync(
            [
              anchor.utils.bytes.utf8.encode("admin"),
              NON_SWAP_AUTHORITY.publicKey.toBuffer(),
            ],
            program.programId,
          );

        const setupIx = await program.methods
          .closeLongPositionSetup({
            expiration: closeRequestExpiration,
            minTargetAmount: new anchor.BN(0),
            interest: new anchor.BN(10),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            longPool: longPoolBKey,
            position: positionKey,
            permission: badCoSignerPermission,
            // @ts-ignore
            authority: NON_SWAP_AUTHORITY.publicKey,
          })
          .instruction();
        const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
          [abSwapKey.publicKey.toBuffer()],
          TOKEN_SWAP_PROGRAM_ID,
        );
        const swapIx = TokenSwap.swapInstruction(
          abSwapKey.publicKey,
          swapAuthority,
          program.provider.publicKey,
          longPoolBVaultKey,
          swapTokenAccountB,
          swapTokenAccountA,
          ownerTokenA,
          poolMint,
          poolFeeAccount,
          null,
          tokenMintB,
          tokenMintA,
          TOKEN_SWAP_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          BigInt(positionBefore.collateralAmount.toString()),
          BigInt(0),
        );
        try {
          await program.methods
            .closeLongPositionCleanup()
            .accounts({
              owner: program.provider.publicKey,
              ownerCurrencyAccount: ownerTokenA,
              longPool: longPoolBKey,
              position: positionKey,
              lpVault: lpVaultKey,
            })
            .preInstructions([setupIx, swapIx])
            .signers([NON_SWAP_AUTHORITY])
            .rpc();
          assert.ok(false);
        } catch (err) {
          if (err instanceof anchor.AnchorError) {
            assert.equal(err.error.errorCode.number, 6008);
          } else if (err instanceof anchor.ProgramError) {
            assert.equal(err.code, 6008);
          } else {
            assert.ok(false);
          }
        }
      });
    });

    describe("with more than one setup IX", () => {
      it("should fail", async () => {
        try {
          const setupIx = await program.methods
            .closeLongPositionSetup({
              expiration: closeRequestExpiration,
              minTargetAmount: new anchor.BN(0),
              interest: new anchor.BN(10),
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
              ownerCurrencyAccount: ownerTokenA,
              longPool: longPoolBKey,
              position: positionKey,
              lpVault: lpVaultKey,
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
              interest: new anchor.BN(10),
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

    // TODO should fail if swap uses less/more than position collateral

    describe("correct setup", () => {
      it("should close the position and return funds", async () => {
        const interestOwed = new anchor.BN(10);
        const positionBefore = await program.account.position.fetch(
          positionKey,
        );
        const vaultKey = getAssociatedTokenAddressSync(
          positionBefore.currency,
          lpVaultKey,
          true,
        );
        const [vaultBefore, ownerABefore] = await getMultipleTokenAccounts(
          program.provider.connection,
          [vaultKey, ownerTokenA],
        );
        const setupIx = await program.methods
          .closeLongPositionSetup({
            expiration: closeRequestExpiration,
            minTargetAmount: new anchor.BN(0),
            interest: interestOwed,
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
        const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
          [abSwapKey.publicKey.toBuffer()],
          TOKEN_SWAP_PROGRAM_ID,
        );
        const swapIx = TokenSwap.swapInstruction(
          abSwapKey.publicKey,
          swapAuthority,
          program.provider.publicKey, //userTransferAuthority
          longPoolBVaultKey, // userSource
          swapTokenAccountB, // poolSource
          swapTokenAccountA, // poolDestination
          ownerTokenA, // userDestination
          poolMint,
          poolFeeAccount,
          null,
          tokenMintB,
          tokenMintA,
          TOKEN_SWAP_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          BigInt(positionBefore.collateralAmount.toString()),
          BigInt(0),
        );
        await program.methods
          .closeLongPositionCleanup()
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            longPool: longPoolBKey,
            position: positionKey,
            lpVault: lpVaultKey,
          })
          .preInstructions([setupIx, swapIx])
          .signers([SWAP_AUTHORITY])
          .rpc();

        const [positionAfter, [vaultAfter, ownerAAfter]] = await Promise.all([
          program.account.position.fetchNullable(positionKey),
          getMultipleTokenAccounts(program.provider.connection, [vaultKey, ownerTokenA]),
        ]);
        assert.isNull(positionAfter);

        // should pay back interest + principal to LP Vault
        const expectedLpVaultDiff = positionBefore.principal.add(interestOwed);
        const vaultDiff = vaultAfter.amount - vaultBefore.amount;
        assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString());

        // Validate the user got the rest
        const ownerADiff = ownerAAfter.amount - ownerABefore.amount;
        assert.equal(ownerADiff.toString(), "950");
      });
    });
  });
});
