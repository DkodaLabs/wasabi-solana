import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  abSwapKey,
  poolFeeAccount,
  poolMint,
  superAdminProgram,
  swapTokenAccountA,
  swapTokenAccountB,
  TOKEN_SWAP_PROGRAM_ID,
  tokenMintA,
  tokenMintB,
} from "./rootHooks";
import { getMultipleTokenAccounts } from "./utils";
import { TokenSwap } from "@solana/spl-token-swap";

describe("OpenLongPosition", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
    program.programId
  );
  const ownerTokenA = getAssociatedTokenAddressSync(
    tokenMintA,
    program.provider.publicKey,
    false
  );
  const [longPoolBKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("long_pool"), tokenMintB.toBuffer()],
    program.programId
  );
  const longPoolBVaultKey = getAssociatedTokenAddressSync(
    tokenMintB,
    longPoolBKey,
    true
  );

  before(async () => {
    // Create LongPool for `tokenMintB` as that will be the collateral held.
    const [superAdminPermissionKey] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("super_admin")],
        program.programId
      );
    await superAdminProgram.methods
      .initLongPool()
      .accounts({
        payer: superAdminProgram.provider.publicKey,
        permission: superAdminPermissionKey,
        assetMint: tokenMintB,
      })
      .rpc();
  });

  describe("with more than one setup IX", () => {
    it("should fail", async () => {
      try {
        const now = new Date().getTime() / 1_000;
        const setupIx = await program.methods
          .openLongPositionSetup({
            minTargetAmount: new anchor.BN(1_900),
            downPayment: new anchor.BN(1_000),
            principal: new anchor.BN(1_000),
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
            longPool: longPoolBKey,
          })
          .instruction();
        await program.methods
          .openLongPositionCleanup()
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            longPool: longPoolBKey,
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
        const now = new Date().getTime() / 1_000;
        await program.methods
          .openLongPositionSetup({
            minTargetAmount: new anchor.BN(1_900),
            downPayment: new anchor.BN(1_000),
            principal: new anchor.BN(1_000),
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
            longPool: longPoolBKey,
          })
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

  describe("with one setup and one cleanup ", () => {
    it("should open a new position", async () => {
      const now = new Date().getTime() / 1_000;

      const lpVault = await program.account.lpVault.fetch(lpVaultKey);
      const [lpVaultBefore, ownerTokenABefore, longPoolBVaultBefore] =
        await getMultipleTokenAccounts(program.provider.connection, [
          lpVault.vault,
          ownerTokenA,
          longPoolBVaultKey,
        ]);

      const downPayment = new anchor.BN(1_000);
      // amount to be borrowed
      const principal = new anchor.BN(1_000);
      const swapAmount = downPayment.add(principal);
      const minimumAmountOut = new anchor.BN(1_900);

      const setupIx = await program.methods
        .openLongPositionSetup({
          minTargetAmount: minimumAmountOut,
          downPayment,
          principal,
          currency: tokenMintA,
          expiration: new anchor.BN(now + 3_600),
        })
        .accounts({
          owner: program.provider.publicKey,
          ownerCurrencyAccount: ownerTokenA,
          lpVault: lpVaultKey,
          longPool: longPoolBKey,
        })
        .instruction();
      const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
        [abSwapKey.publicKey.toBuffer()],
        TOKEN_SWAP_PROGRAM_ID
      );
      const swapIx = TokenSwap.swapInstruction(
        abSwapKey.publicKey,
        swapAuthority,
        program.provider.publicKey,
        ownerTokenA,
        swapTokenAccountA,
        swapTokenAccountB,
        longPoolBVaultKey,
        poolMint,
        poolFeeAccount,
        null,
        tokenMintA,
        tokenMintB,
        TOKEN_SWAP_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        BigInt(swapAmount.toString()),
        BigInt(minimumAmountOut.toString())
      );
      await program.methods
        .openLongPositionCleanup()
        .accounts({
          owner: program.provider.publicKey,
          ownerCurrencyAccount: ownerTokenA,
          longPool: longPoolBKey,
        })
        .preInstructions([setupIx, swapIx])
        .rpc({ skipPreflight: true });

      const [lpVaultAfter, ownerTokenAAfter, longPoolBVaultAfter] =
        await getMultipleTokenAccounts(program.provider.connection, [
          lpVault.vault,
          ownerTokenA,
          longPoolBVaultKey,
        ]);

      // Assert vault balance decreased by Principal
      assert.equal(
        lpVaultAfter.amount,
        lpVaultBefore.amount - BigInt(principal.toString())
      );
      // Assert user balance decreased by downpayment
      assert.equal(
        ownerTokenAAfter.amount,
        ownerTokenABefore.amount - BigInt(downPayment.toString())
      );
      // Assert collateral vault balance has increased
      assert.isTrue(longPoolBVaultAfter.amount > longPoolBVaultBefore.amount);
    });

    it("should fail with noop", async () => {
      const now = new Date().getTime() / 1_000;

      const downPayment = new anchor.BN(1_000);
      // amount to be borrowed
      const principal = new anchor.BN(1_000);
      const minimumAmountOut = new anchor.BN(1_900);
      try {
        const setupIx = await program.methods
          .openLongPositionSetup({
            minTargetAmount: minimumAmountOut,
            downPayment,
            principal,
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
            longPool: longPoolBKey,
          })
          .instruction();
        await program.methods
          .openLongPositionCleanup()
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            longPool: longPoolBKey,
          })
          .preInstructions([setupIx])
          .rpc({ skipPreflight: true });
        assert.ok(false);
      } catch (err) {
        if (err instanceof anchor.AnchorError) {
          assert.equal(err.error.errorCode.number, 6004);
        } else if (err instanceof anchor.ProgramError) {
          assert.equal(err.code, 6004);
        } else {
          assert.ok(false);
        }
      }
    });

    it("should fail with using more than downpayment + principal", async () => {
      const now = new Date().getTime() / 1_000;

      const downPayment = new anchor.BN(1_000);
      // amount to be borrowed
      const principal = new anchor.BN(1_000);
      const minimumAmountOut = new anchor.BN(1_900);
      try {
        const setupIx = await program.methods
          .openLongPositionSetup({
            minTargetAmount: minimumAmountOut,
            downPayment,
            principal,
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
            longPool: longPoolBKey,
          })
          .instruction();
        const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
          [abSwapKey.publicKey.toBuffer()],
          TOKEN_SWAP_PROGRAM_ID
        );

        const swapIx = TokenSwap.swapInstruction(
          abSwapKey.publicKey,
          swapAuthority,
          program.provider.publicKey,
          ownerTokenA,
          swapTokenAccountA,
          swapTokenAccountB,
          longPoolBVaultKey,
          poolMint,
          poolFeeAccount,
          null,
          tokenMintA,
          tokenMintB,
          TOKEN_SWAP_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          BigInt(3_000),
          BigInt(minimumAmountOut.toString())
        );
        await program.methods
          .openLongPositionCleanup()
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            longPool: longPoolBKey,
          })
          .preInstructions([setupIx, swapIx])
          .rpc({ skipPreflight: true });
        assert.ok(false);
      } catch (err) {
        if (err instanceof anchor.AnchorError) {
          assert.equal(err.error.errorCode.number, 6005);
        } else if (err instanceof anchor.ProgramError) {
          assert.equal(err.code, 6005);
        } else {
          assert.ok(false);
        }
      }
    });

    it("should fail with incorrect pool", async () => {
      const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [anchor.utils.bytes.utf8.encode("super_admin")],
          program.programId
        );
      await superAdminProgram.methods
        .initShortPool()
        .accounts({
          payer: superAdminProgram.provider.publicKey,
          permission: superAdminPermissionKey,
          assetMint: tokenMintB,
        })
        .rpc();
      const [shortPoolBKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("short_pool"), tokenMintB.toBuffer()],
        program.programId
      );
      const now = new Date().getTime() / 1_000;

      const downPayment = new anchor.BN(1_000);
      // amount to be borrowed
      const principal = new anchor.BN(1_000);
      const minimumAmountOut = new anchor.BN(1_900);
      try {
        const setupIx = await program.methods
          .openLongPositionSetup({
            minTargetAmount: minimumAmountOut,
            downPayment,
            principal,
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
            longPool: longPoolBKey,
          })
          .instruction();
        const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
          [abSwapKey.publicKey.toBuffer()],
          TOKEN_SWAP_PROGRAM_ID
        );

        const swapIx = TokenSwap.swapInstruction(
          abSwapKey.publicKey,
          swapAuthority,
          program.provider.publicKey,
          ownerTokenA,
          swapTokenAccountA,
          swapTokenAccountB,
          longPoolBVaultKey,
          poolMint,
          poolFeeAccount,
          null,
          tokenMintA,
          tokenMintB,
          TOKEN_SWAP_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          BigInt(downPayment.add(principal).toString()),
          BigInt(minimumAmountOut.toString())
        );
        await program.methods
          .openLongPositionCleanup()
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            longPool: shortPoolBKey,
          })
          .preInstructions([setupIx, swapIx])
          .rpc({ skipPreflight: true });
        assert.ok(false);
      } catch (err) {
        if (err instanceof anchor.AnchorError) {
          assert.equal(err.error.errorCode.number, 6006);
        } else if (err instanceof anchor.ProgramError) {
          assert.equal(err.code, 6006);
        } else {
          assert.ok(false);
        }
      }
    });
  });
});
