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
  });

  describe("with more than one setup IX", () => {
    it("should fail", async () => {
      const nonce = 100;
      // const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
      //   [
      //     anchor.utils.bytes.utf8.encode("position"),
      //     program.provider.publicKey.toBuffer(),
      //     shortPoolAKey.toBuffer(),
      //     lpVaultKey.toBuffer(),
      //     new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
      //   ],
      //   program.programId
      // );
      try {
        const now = new Date().getTime() / 1_000;
        const setupIx = await program.methods
          .openShortPositionSetup({
            nonce,
            downPayment: new anchor.BN(1_000),
            principal: new anchor.BN(1_000),
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
            shortPool: shortPoolAKey,
            // permission: coSignerPermission,
            // authority: SWAP_AUTHORITY.publicKey,
          })
          .instruction();
        await program.methods
          .openShortPositionCleanup()
          .accounts({
            // owner: program.provider.publicKey,
            // ownerCurrencyAccount: ownerTokenA,
            // longPool: shortPoolAKey,
            // position: positionKey,
          })
          .preInstructions([setupIx, setupIx])
          // .signers([SWAP_AUTHORITY])
          .rpc({ skipPreflight: true });
        assert.ok(false);
      } catch (err) {
        assert.ok(true);
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
            downPayment: new anchor.BN(1_000),
            principal: new anchor.BN(1_000),
            currency: tokenMintA,
            expiration: new anchor.BN(now + 3_600),
          })
          .accounts({
            owner: program.provider.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            lpVault: lpVaultKey,
            shortPool: shortPoolAKey,
            // permission: coSignerPermission,
            // authority: SWAP_AUTHORITY.publicKey,
          })
          // .signers([SWAP_AUTHORITY])
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
      const swapAmount = downPayment.add(principal);
      const minimumAmountOut = new anchor.BN(1_900);

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
          downPayment,
          principal,
          currency: tokenMintA,
          expiration: new anchor.BN(now + 3_600),
        })
        .accounts({
          owner: program.provider.publicKey,
          ownerCurrencyAccount: ownerTokenA,
          lpVault: lpVaultKey,
          shortPool: shortPoolAKey,
          permission: badCoSignerPermission,
          authority: NON_SWAP_AUTHORITY.publicKey,
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
      //   ownerTokenA,
      //   swapTokenAccountA,
      //   swapTokenAccountB,
      //   longPoolBVaultKey,
      //   poolMint,
      //   poolFeeAccount,
      //   null,
      //   tokenMintA,
      //   tokenMintB,
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
            ownerCurrencyAccount: ownerTokenA,
            shortPool: shortPoolAKey,
            position: positionKey,
          })
          .preInstructions([setupIx])
          .signers([NON_SWAP_AUTHORITY])
          .rpc();
        assert.ok(false);
      } catch (err) {
        console.log(err);
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

  describe("with one setup and one cleanup ", () => {
    // it("should open short position", async () => {
    //   const nonce = 0;
    //   const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
    //     [
    //       anchor.utils.bytes.utf8.encode("position"),
    //       program.provider.publicKey.toBuffer(),
    //       shortPoolAKey.toBuffer(),
    //       lpVaultKey.toBuffer(),
    //       new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
    //     ],
    //     program.programId
    //   );
    //   const lpVault = await program.account.lpVault.fetch(lpVaultKey);
    //   const [lpVaultBefore, ownerTokenABefore, shortPoolAVaultBefore] =
    //     await getMultipleTokenAccounts(program.provider.connection, [
    //       lpVault.vault,
    //       ownerTokenA,
    //       shortPoolAVaultKey,
    //     ]);
    //   const now = new Date().getTime() / 1_000;
    //   const downPayment = new anchor.BN(1_000);
    //   // amount to be borrowed
    //   const principal = new anchor.BN(1_000);
    //   const swapAmount = downPayment.add(principal);
    //   const minimumAmountOut = new anchor.BN(1_900);
    //   const setupIx = await program.methods
    //     .openLongPositionSetup({
    //       nonce: 0,
    //       minTargetAmount: minimumAmountOut,
    //       downPayment,
    //       principal,
    //       currency: tokenMintA,
    //       expiration: new anchor.BN(now + 3_600),
    //     })
    //     .accounts({
    //       owner: program.provider.publicKey,
    //       ownerCurrencyAccount: ownerTokenB,
    //       lpVault: lpVaultKey,
    //       longPool: shortPoolAKey,
    //       permission: coSignerPermission,
    //       authority: SWAP_AUTHORITY.publicKey,
    //     })
    //     .instruction();
    //   // const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
    //   //   [abSwapKey.publicKey.toBuffer()],
    //   //   TOKEN_SWAP_PROGRAM_ID
    //   // );
    //   // const swapIx = TokenSwap.swapInstruction(
    //   //   abSwapKey.publicKey,
    //   //   swapAuthority,
    //   //   program.provider.publicKey,
    //   //   ownerTokenB,
    //   //   swapTokenAccountB,
    //   //   swapTokenAccountA,
    //   //   shortPoolAVaultKey,
    //   //   poolMint,
    //   //   poolFeeAccount,
    //   //   null,
    //   //   tokenMintA,
    //   //   tokenMintB,
    //   //   TOKEN_SWAP_PROGRAM_ID,
    //   //   TOKEN_PROGRAM_ID,
    //   //   TOKEN_PROGRAM_ID,
    //   //   TOKEN_PROGRAM_ID,
    //   //   BigInt(swapAmount.toString()),
    //   //   BigInt(minimumAmountOut.toString())
    //   // );
    //   await program.methods
    //     .openLongPositionCleanup()
    //     .accounts({
    //       owner: program.provider.publicKey,
    //       ownerCurrencyAccount: ownerTokenB,
    //       longPool: shortPoolAKey,
    //       position: positionKey,
    //     })
    //     .preInstructions([setupIx])
    //     .signers([SWAP_AUTHORITY])
    //     .rpc({ skipPreflight: true });
    //   const [[lpVaultAfter, ownerTokenAAfter, shortPoolAVaultAfter]] =
    //     await Promise.all([
    //       getMultipleTokenAccounts(program.provider.connection, [
    //         lpVault.vault,
    //         ownerTokenA,
    //         shortPoolAVaultKey,
    //       ]),
    //     ]);
    //   // Assert vault balance decreased by Principal
    //   assert.equal(
    //     lpVaultAfter.amount,
    //     lpVaultBefore.amount - BigInt(principal.toString())
    //   );
    //   // Assert user balance decreased by downpayment
    //   assert.equal(
    //     ownerTokenAAfter.amount,
    //     ownerTokenABefore.amount - BigInt(downPayment.toString())
    //   );
    //   // Assert collateral vault balance has increased
    //   assert.isTrue(shortPoolAVaultAfter.amount > shortPoolAVaultAfter.amount);
    // });
  });
});
