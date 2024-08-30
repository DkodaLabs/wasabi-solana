import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
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
} from "./rootHooks";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getMultipleTokenAccounts } from "./utils";
import { TOKEN_SWAP_PROGRAM_ID, TokenSwap } from "@solana/spl-token-swap";
import { assert } from "chai";

describe("OpenShortPosition", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  const [coSignerPermission] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("admin"),
      SWAP_AUTHORITY.publicKey.toBuffer(),
    ],
    program.programId
  );
  const [superAdminPermissionKey] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("super_admin")],
      program.programId
    );
  // Collateral currency is tokenMintA (short_pool)
  // Borrowed currency is tokenMintB (lp_vault)
  // Downpayment currency is tokenMintA
  const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintB.toBuffer()],
    program.programId
  );
  let lpVault: anchor.IdlAccounts<WasabiSolana>["lpVault"];
  const ownerTokenA = getAssociatedTokenAddressSync(
    tokenMintA,
    program.provider.publicKey,
    false
  );
  const ownerTokenB = getAssociatedTokenAddressSync(
    tokenMintB,
    program.provider.publicKey,
    false
  );
  const [shortPoolAKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("short_pool"), tokenMintA.toBuffer()],
    program.programId
  );
  const shortPoolAVaultKey = getAssociatedTokenAddressSync(
    tokenMintA,
    shortPoolAKey,
    true
  );
  const [openPositionRequestKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("open_pos"),
      program.provider.publicKey.toBuffer(),
    ],
    program.programId
  );

  before(async () => {
    await superAdminProgram.methods
      .initLpVault()
      .accounts({
        payer: superAdminProgram.provider.publicKey,
        permission: superAdminPermissionKey,
        assetMint: tokenMintB,
      })
      .rpc();
    lpVault = await program.account.lpVault.fetch(lpVaultKey);
    const ownerSharesAccount = getAssociatedTokenAddressSync(
      lpVault.sharesMint,
      program.provider.publicKey,
      false
    );
    const createAtaIx = createAssociatedTokenAccountInstruction(
      program.provider.publicKey,
      ownerSharesAccount,
      program.provider.publicKey,
      lpVault.sharesMint
    );
    await program.methods
      .deposit({ amount: new anchor.BN(500_000) })
      .accounts({
        owner: program.provider.publicKey,
        ownerAssetAccount: ownerTokenB,
        ownerSharesAccount,
        lpVault: lpVaultKey,
      })
      .preInstructions([createAtaIx])
      .rpc();
  });

  describe("with more than one setup IX", () => {
    it("should fail", async () => {
      const nonce = 100;
      const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("position"),
          program.provider.publicKey.toBuffer(),
          shortPoolAKey.toBuffer(),
          lpVaultKey.toBuffer(),
          new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
        ],
        program.programId
      );
      try {
        const now = new Date().getTime() / 1_000;
        const setupIx = await program.methods
          .openShortPositionSetup({
            nonce,
            minTargetAmount: new anchor.BN(1),
            downPayment: new anchor.BN(1_000),
            principal: new anchor.BN(1_000),
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenB,
            ownerTargetCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
            shortPool: shortPoolAKey,
            permission: coSignerPermission,
            authority: SWAP_AUTHORITY.publicKey,
            position: positionKey,
          })
          .instruction();
        await program.methods
          .openShortPositionCleanup()
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenB,
            shortPool: shortPoolAKey,
            position: positionKey,
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
        const now = new Date().getTime() / 1_000;
        await program.methods
          .openShortPositionSetup({
            nonce: 100,
            minTargetAmount: new anchor.BN(1),
            downPayment: new anchor.BN(1_000),
            principal: new anchor.BN(1_000),
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenB,
            ownerTargetCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
            shortPool: shortPoolAKey,
            permission: coSignerPermission,
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

  describe("Without swap co-signer", () => {
    it("Should fail", async () => {
      const nonce = 1;
      const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("position"),
          program.provider.publicKey.toBuffer(),
          shortPoolAKey.toBuffer(),
          lpVaultKey.toBuffer(),
          new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
        ],
        program.programId
      );
      const now = new Date().getTime() / 1_000;

      const downPayment = new anchor.BN(1_000);
      // amount to be borrowed
      const principal = new anchor.BN(1_000);
      const minTargetAmount = new anchor.BN(1);

      const [badCoSignerPermission] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [
            anchor.utils.bytes.utf8.encode("admin"),
            NON_SWAP_AUTHORITY.publicKey.toBuffer(),
          ],
          program.programId
        );

      const setupIx = await program.methods
        .openShortPositionSetup({
          nonce,
          minTargetAmount,
          downPayment,
          principal,
          currency: tokenMintA,
          expiration: new anchor.BN(now + 3_600),
        })
        .accounts({
          owner: program.provider.publicKey,
          ownerCurrencyAccount: ownerTokenB,
          ownerTargetCurrencyAccount: ownerTokenA,
          lpVault: lpVaultKey,
          shortPool: shortPoolAKey,
          permission: badCoSignerPermission,
          authority: NON_SWAP_AUTHORITY.publicKey,
          position: positionKey,
        })
        .instruction();
      // const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
      //   [abSwapKey.publicKey.toBuffer()],
      //   TOKEN_SWAP_PROGRAM_ID
      // );
      // const swapIx = TokenSwap.swapInstruction(
      //   abSwapKey.publicKey,
      //   swapAuthority,
      //   program.provider.publicKey,
      //   ownerTokenB,
      //   swapTokenAccountB,
      //   swapTokenAccountA,
      //   shortPoolAVaultKey,
      //   poolMint,
      //   poolFeeAccount,
      //   null,
      //   tokenMintB,
      //   tokenMintA,
      //   TOKEN_SWAP_PROGRAM_ID,
      //   TOKEN_PROGRAM_ID,
      //   TOKEN_PROGRAM_ID,
      //   TOKEN_PROGRAM_ID,
      //   BigInt(swapAmount.toString()),
      //   BigInt(minimumAmountOut.toString())
      // );
      try {
        await program.methods
          .openShortPositionCleanup()
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenB,
            shortPool: shortPoolAKey,
            position: positionKey,
          })
          .preInstructions([setupIx])
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

  describe("with one setup and one cleanup", () => {
    it("should open short position", async () => {
      const nonce = 0;
      const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("position"),
          program.provider.publicKey.toBuffer(),
          shortPoolAKey.toBuffer(),
          lpVaultKey.toBuffer(),
          new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
        ],
        program.programId
      );
      const [lpVaultBefore, ownerTokenABefore, shortPoolAVaultBefore] =
        await getMultipleTokenAccounts(program.provider.connection, [
          lpVault.vault,
          ownerTokenA,
          shortPoolAVaultKey,
        ]);
      const now = new Date().getTime() / 1_000;
      const downPayment = new anchor.BN(1_000);
      // amount to be borrowed
      const principal = new anchor.BN(1_000);
      const swapAmount = downPayment.add(principal);
      const minTargetAmount = new anchor.BN(1);
      const setupIx = await program.methods
        .openShortPositionSetup({
          nonce: 0,
          minTargetAmount,
          downPayment,
          principal,
          currency: tokenMintA,
          expiration: new anchor.BN(now + 3_600),
        })
        .accounts({
          owner: program.provider.publicKey,
          ownerCurrencyAccount: ownerTokenB,
          ownerTargetCurrencyAccount: ownerTokenA,
          lpVault: lpVaultKey,
          shortPool: shortPoolAKey,
          permission: coSignerPermission,
          authority: SWAP_AUTHORITY.publicKey,
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
        ownerTokenB,
        swapTokenAccountB,
        swapTokenAccountA,
        shortPoolAVaultKey,
        poolMint,
        poolFeeAccount,
        null,
        tokenMintB,
        tokenMintA,
        TOKEN_SWAP_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        BigInt(swapAmount.toString()),
        BigInt(minTargetAmount.toString())
      );
      await program.methods
        .openShortPositionCleanup()
        .accounts({
          owner: program.provider.publicKey,
          ownerCurrencyAccount: ownerTokenB,
          shortPool: shortPoolAKey,
          position: positionKey,
        })
        .preInstructions([setupIx, swapIx])
        .signers([SWAP_AUTHORITY])
        .rpc();
      const [[lpVaultAfter, ownerTokenAAfter, shortPoolAVaultAfter]] =
        await Promise.all([
          getMultipleTokenAccounts(program.provider.connection, [
            lpVault.vault,
            ownerTokenA,
            shortPoolAVaultKey,
          ]),
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
      assert.isTrue(shortPoolAVaultAfter.amount > shortPoolAVaultAfter.amount);
    });

    it.skip("should fail with noop", async () => {
      const nonce = 100;
      const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("position"),
          program.provider.publicKey.toBuffer(),
          shortPoolAKey.toBuffer(),
          lpVaultKey.toBuffer(),
          new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
        ],
        program.programId
      );
      const now = new Date().getTime() / 1_000;

      const downPayment = new anchor.BN(1_000);
      // amount to be borrowed
      const principal = new anchor.BN(1_000);
      const minTargetAmount = new anchor.BN(1);
      try {
        const setupIx = await program.methods
          .openShortPositionSetup({
            nonce,
            minTargetAmount,
            downPayment,
            principal,
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenB,
            ownerTargetCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
            shortPool: shortPoolAKey,
            permission: coSignerPermission,
            authority: SWAP_AUTHORITY.publicKey,
          })
          .instruction();
        await program.methods
          .openShortPositionCleanup()
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenB,
            shortPool: shortPoolAKey,
            position: positionKey,
          })
          .preInstructions([setupIx])
          .signers([SWAP_AUTHORITY])
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

    it.skip("should fail with incorrect pool", async () => {
      const nonce = 100;
      const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("position"),
          program.provider.publicKey.toBuffer(),
          shortPoolAKey.toBuffer(),
          lpVaultKey.toBuffer(),
          new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
        ],
        program.programId
      );
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
      const minTargetAmount = new anchor.BN(1);
      try {
        const setupIx = await program.methods
          .openShortPositionSetup({
            nonce,
            minTargetAmount,
            downPayment,
            principal,
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenB,
            ownerTargetCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
            shortPool: shortPoolAKey,
            permission: coSignerPermission,
            authority: SWAP_AUTHORITY.publicKey,
            position: positionKey,
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
          ownerTokenB,
          swapTokenAccountB,
          swapTokenAccountA,
          shortPoolAKey,
          poolMint,
          poolFeeAccount,
          null,
          tokenMintB,
          tokenMintA,
          TOKEN_SWAP_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          BigInt(downPayment.add(principal).toString()),
          BigInt(minTargetAmount.toString())
        );
        await program.methods
          .openShortPositionCleanup()
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenB,
            shortPool: shortPoolBKey,
            position: positionKey,
          })
          .preInstructions([setupIx, swapIx])
          .signers([SWAP_AUTHORITY])
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

    it.skip("should fail with incorrect position", async () => {
      const nonce = 100;
      const [badPositionKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("position"),
          program.provider.publicKey.toBuffer(),
          shortPoolAKey.toBuffer(),
          lpVaultKey.toBuffer(),
          new anchor.BN(0).toArrayLike(Buffer, "le", 2),
        ],
        program.programId
      );
      const now = new Date().getTime() / 1_000;

      const downPayment = new anchor.BN(1_000);
      // amount to be borrowed
      const principal = new anchor.BN(1_000);
      const minTargetAmount = new anchor.BN(1);
      try {
        const setupIx = await program.methods
          .openShortPositionSetup({
            nonce,
            minTargetAmount,
            downPayment,
            principal,
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenB,
            ownerTargetCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
            shortPool: shortPoolAKey,
            permission: coSignerPermission,
            authority: SWAP_AUTHORITY.publicKey,
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
          ownerTokenB,
          swapTokenAccountB,
          swapTokenAccountA,
          shortPoolAKey,
          poolMint,
          poolFeeAccount,
          null,
          tokenMintB,
          tokenMintA,
          TOKEN_SWAP_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          BigInt(downPayment.add(principal).toString()),
          BigInt(minTargetAmount.toString())
        );
        await program.methods
          .openShortPositionCleanup()
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenB,
            shortPool: shortPoolAKey,
            position: badPositionKey,
          })
          .preInstructions([setupIx, swapIx])
          .signers([SWAP_AUTHORITY])
          .rpc({ skipPreflight: true });
        assert.ok(false);
      } catch (err) {
        if (err instanceof anchor.AnchorError) {
          assert.equal(err.error.errorCode.number, 6007);
        } else if (err instanceof anchor.ProgramError) {
          assert.equal(err.code, 6007);
        } else {
          assert.ok(false);
        }
      }
    });
  });
});
