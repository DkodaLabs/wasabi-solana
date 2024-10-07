import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
  abSwapKey,
  feeWalletA,
  NON_SWAP_AUTHORITY,
  openPosLut,
  poolFeeAccount,
  poolMint,
  SWAP_AUTHORITY,
  swapTokenAccountA,
  swapTokenAccountB,
  tokenMintA,
  tokenMintB,
  user2,
} from "./rootHooks";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TOKEN_SWAP_PROGRAM_ID, TokenSwap } from "@solana/spl-token-swap";
import { assert } from "chai";
import { getMultipleTokenAccounts } from "./utils";

describe("liquidate", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  const [coSignerPermission] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("admin"),
      SWAP_AUTHORITY.publicKey.toBuffer(),
    ],
    program.programId
  );
  const [liquidateSignerPermission] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("admin"),
      NON_SWAP_AUTHORITY.publicKey.toBuffer(),
    ],
    program.programId
  );

  const [globalSettingsKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("global_settings")],
    program.programId
  );
  const [lpVaultTokenAKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
    program.programId
  );
  const [lpVaultTokenBKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintB.toBuffer()],
    program.programId
  );
  const ownerTokenA = getAssociatedTokenAddressSync(
    tokenMintA,
    user2.publicKey,
    false
  );
  const ownerTokenB = getAssociatedTokenAddressSync(
    tokenMintB,
    user2.publicKey,
    false
  );
  const [longPoolBKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("long_pool"),
      tokenMintB.toBuffer(),
      tokenMintA.toBuffer(),
    ],
    program.programId
  );
  const longPoolBVaultKey = getAssociatedTokenAddressSync(
    tokenMintB,
    longPoolBKey,
    true
  );
  const longPoolBCurrencyVaultKey = getAssociatedTokenAddressSync(
    tokenMintA,
    longPoolBKey,
    true
  );
  const [shortPoolAKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("short_pool"),
      tokenMintA.toBuffer(),
      tokenMintB.toBuffer(),
    ],
    program.programId
  );
  const shortPoolAVaultKey = getAssociatedTokenAddressSync(
    tokenMintA,
    shortPoolAKey,
    true
  );
  const shortPoolACurrencyVaultKey = getAssociatedTokenAddressSync(
    tokenMintB,
    shortPoolAKey,
    true
  );
  const nonce = 16;
  const [longPositionKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("position"),
      user2.publicKey.toBuffer(),
      longPoolBKey.toBuffer(),
      lpVaultTokenAKey.toBuffer(),
      new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
    ],
    program.programId
  );
  const [shortPositionKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("position"),
      user2.publicKey.toBuffer(),
      shortPoolAKey.toBuffer(),
      lpVaultTokenBKey.toBuffer(),
      new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
    ],
    program.programId
  );

  describe("Long", () => {
    before(async () => {
      // Create Long position that will have a TP order
      const fee = new anchor.BN(10);
      const now = new Date().getTime() / 1_000;

      const downPayment = new anchor.BN(1_000);
      // amount to be borrowed
      const principal = new anchor.BN(1_000);
      const swapAmount = downPayment.add(principal);
      const minimumAmountOut = new anchor.BN(1_900);

      const setupIx = await program.methods
        .openLongPositionSetup({
          nonce,
          minTargetAmount: minimumAmountOut,
          downPayment,
          principal,
          currency: tokenMintA,
          expiration: new anchor.BN(now + 3_600),
          fee,
        })
        .accounts({
          owner: user2.publicKey,
          ownerCurrencyAccount: ownerTokenA,
          currencyVault: longPoolBCurrencyVaultKey,
          lpVault: lpVaultTokenAKey,
          longPool: longPoolBKey,
          permission: coSignerPermission,
          authority: SWAP_AUTHORITY.publicKey,
          feeWallet: feeWalletA,
          globalSettings: globalSettingsKey,
        })
        .instruction();
      const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
        [abSwapKey.publicKey.toBuffer()],
        TOKEN_SWAP_PROGRAM_ID
      );
      const swapIx = TokenSwap.swapInstruction(
        abSwapKey.publicKey,
        swapAuthority,
        SWAP_AUTHORITY.publicKey,
        longPoolBCurrencyVaultKey,
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
      const _tx = await program.methods
        .openLongPositionCleanup()
        .accounts({
          owner: user2.publicKey,
          longPool: longPoolBKey,
          position: longPositionKey,
        })
        .preInstructions([setupIx, swapIx])
        .transaction();

      const connection = program.provider.connection;
      const lookupAccount = await connection
        .getAddressLookupTable(openPosLut)
        .catch(() => null);
      const message = new anchor.web3.TransactionMessage({
        instructions: _tx.instructions,
        payerKey: program.provider.publicKey!,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      }).compileToV0Message([lookupAccount.value]);

      const tx = new anchor.web3.VersionedTransaction(message);
      await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY, user2], {
        skipPreflight: false,
      });
    });

    it("should fail without liquidate permissions", async () => {
      const closeRequestExpiration = new anchor.BN(
        Date.now() / 1_000 + 60 * 60
      );
      const positionBefore = await program.account.position.fetch(
        longPositionKey
      );

      const setupIx = await program.methods
        .liquidatePositionSetup({
          expiration: closeRequestExpiration,
          minTargetAmount: new anchor.BN(0),
          interest: new anchor.BN(10),
          executionFee: new anchor.BN(11),
        })
        .accounts({
          closePositionSetup: {
            pool: longPoolBKey,
            owner: user2.publicKey,
            currencyVault: longPoolBCurrencyVaultKey,
            position: longPositionKey,
            permission: coSignerPermission,
            // @ts-ignore
            authority: SWAP_AUTHORITY.publicKey,
          },
        })
        .instruction();
      const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
        [abSwapKey.publicKey.toBuffer()],
        TOKEN_SWAP_PROGRAM_ID
      );
      const swapIx = TokenSwap.swapInstruction(
        abSwapKey.publicKey,
        swapAuthority,
        SWAP_AUTHORITY.publicKey,
        longPoolBVaultKey,
        swapTokenAccountB,
        swapTokenAccountA,
        longPoolBCurrencyVaultKey,
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
        BigInt(0)
      );
      try {

        const _tx = await program.methods
          .liquidatePositionCleanup()
          .accounts({
            closePositionCleanup: {
              owner: user2.publicKey,
              ownerCurrencyAccount: ownerTokenA,
              ownerCollateralAccount: ownerTokenB,
              currencyVault: longPoolBCurrencyVaultKey,
              pool: longPoolBKey,
              position: longPositionKey,
              lpVault: lpVaultTokenAKey,
              feeWallet: feeWalletA,
              globalSettings: globalSettingsKey,
            },
          })
          .preInstructions([setupIx, swapIx])
          .transaction();
        const connection = program.provider.connection;
        const lookupAccount = await connection
          .getAddressLookupTable(openPosLut)
          .catch(() => null);
        const message = new anchor.web3.TransactionMessage({
          instructions: _tx.instructions,
          payerKey: program.provider.publicKey!,
          recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        }).compileToV0Message([lookupAccount.value]);
  
        const tx = new anchor.web3.VersionedTransaction(message);
        await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
          skipPreflight: true,
        });
      } catch (e) {
        const err = anchor.translateError(
          e,
          anchor.parseIdlErrors(program.idl)
        );
        if (err instanceof anchor.AnchorError) {
          assert.equal(err.error.errorCode.number, 6000);
        } else if (err instanceof anchor.ProgramError) {
          assert.equal(err.code, 6000);
        } else {
          assert.ok(false);
        }
      }
    });

    it("should liquidate position", async () => {
      const closeRequestExpiration = new anchor.BN(
        Date.now() / 1_000 + 60 * 60
      );
      const positionBefore = await program.account.position.fetch(
        longPositionKey
      );
      const vaultKey = getAssociatedTokenAddressSync(
        positionBefore.currency,
        lpVaultTokenAKey,
        true
      );
      const [vaultBefore, ownerABefore, feeBalanceBefore] =
        await getMultipleTokenAccounts(program.provider.connection, [
          vaultKey,
          ownerTokenA,
          feeWalletA,
        ]);

      const setupIx = await program.methods
        .liquidatePositionSetup({
          expiration: closeRequestExpiration,
          minTargetAmount: new anchor.BN(0),
          interest: new anchor.BN(10),
          executionFee: new anchor.BN(11),
        })
        .accounts({
          closePositionSetup: {
            pool: longPoolBKey,
            owner: user2.publicKey,
            currencyVault: longPoolBCurrencyVaultKey,
            position: longPositionKey,
            permission: liquidateSignerPermission,
            // @ts-ignore
            authority: NON_SWAP_AUTHORITY.publicKey,
          },
        })
        .instruction();
      const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
        [abSwapKey.publicKey.toBuffer()],
        TOKEN_SWAP_PROGRAM_ID
      );
      const swapIx = TokenSwap.swapInstruction(
        abSwapKey.publicKey,
        swapAuthority,
        NON_SWAP_AUTHORITY.publicKey,
        longPoolBVaultKey,
        swapTokenAccountB,
        swapTokenAccountA,
        longPoolBCurrencyVaultKey,
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
        BigInt(0)
      );
      const _tx = await program.methods
        .liquidatePositionCleanup()
        .accounts({
          closePositionCleanup: {
            owner: user2.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            ownerCollateralAccount: ownerTokenB,
            currencyVault: longPoolBCurrencyVaultKey,
            pool: longPoolBKey,
            position: longPositionKey,
            lpVault: lpVaultTokenAKey,
            feeWallet: feeWalletA,
            globalSettings: globalSettingsKey,
          },
        })
        .preInstructions([setupIx, swapIx])
        .transaction();
      const connection = program.provider.connection;
      const lookupAccount = await connection
        .getAddressLookupTable(openPosLut)
        .catch(() => null);
      const message = new anchor.web3.TransactionMessage({
        instructions: _tx.instructions,
        payerKey: program.provider.publicKey!,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      }).compileToV0Message([lookupAccount.value]);

      const tx = new anchor.web3.VersionedTransaction(message);
      await program.provider.sendAndConfirm(tx, [NON_SWAP_AUTHORITY], {
        skipPreflight: true,
      });

      const [
        positionAfter,
        [vaultAfter, ownerAAfter, feeBalanceAfter],
      ] = await Promise.all([
        program.account.position.fetchNullable(longPositionKey),
        getMultipleTokenAccounts(program.provider.connection, [
          vaultKey,
          ownerTokenA,
          feeWalletA,
        ]),
      ]);
      // Position should be cleaned up
      assert.isNull(positionAfter);

      // should pay back some interest/principal
      const vaultDiff = vaultAfter.amount - vaultBefore.amount;
      assert.ok(vaultDiff > 0);

      // Owner should have received payout
      const ownerADiff = ownerAAfter.amount - ownerABefore.amount;
      assert.ok(ownerADiff > 0);

      // Fees should have been paid
      const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
      assert.ok(feeBalanceDiff > 0);
    });
  });

  describe("Short", () => {
    before(async () => {
      const fee = new anchor.BN(10);
      const now = new Date().getTime() / 1_000;
      const downPayment = new anchor.BN(1_000);
      // amount to be borrowed
      const principal = new anchor.BN(1_000);
      const swapAmount = principal;
      const minTargetAmount = new anchor.BN(1);
      const setupIx = await program.methods
        .openShortPositionSetup({
          nonce,
          minTargetAmount,
          downPayment,
          principal,
          currency: tokenMintA,
          expiration: new anchor.BN(now + 3_600),
          fee,
        })
        .accounts({
          owner: user2.publicKey,
          ownerCurrencyAccount: ownerTokenB,
          ownerTargetCurrencyAccount: ownerTokenA,
          lpVault: lpVaultTokenBKey,
          shortPool: shortPoolAKey,
          permission: coSignerPermission,
          authority: SWAP_AUTHORITY.publicKey,
          feeWallet: feeWalletA,
          globalSettings: globalSettingsKey,
        })
        .instruction();
      const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
        [abSwapKey.publicKey.toBuffer()],
        TOKEN_SWAP_PROGRAM_ID
      );
      const swapIx = TokenSwap.swapInstruction(
        abSwapKey.publicKey,
        swapAuthority,
        SWAP_AUTHORITY.publicKey,
        shortPoolACurrencyVaultKey,
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
      const _tx = await program.methods
        .openShortPositionCleanup()
        .accounts({
          owner: user2.publicKey,
          shortPool: shortPoolAKey,
          position: shortPositionKey,
          lpVault: lpVaultTokenBKey,
        })
        .preInstructions([setupIx, swapIx])
        .transaction();

      const connection = program.provider.connection;
      const lookupAccount = await connection
        .getAddressLookupTable(openPosLut)
        .catch(() => null);
      const message = new anchor.web3.TransactionMessage({
        instructions: _tx.instructions,
        payerKey: program.provider.publicKey!,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      }).compileToV0Message([lookupAccount.value]);

      const tx = new anchor.web3.VersionedTransaction(message);
      await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY, user2], {
        skipPreflight: true,
      });
    });

    it("Should liquidate position", async () => {
      const closeRequestExpiration = new anchor.BN(
        Date.now() / 1_000 + 60 * 60
      );
      const positionBefore = await program.account.position.fetch(
        shortPositionKey
      );
      const vaultKey = getAssociatedTokenAddressSync(
        positionBefore.currency,
        lpVaultTokenBKey,
        true
      );
      const [vaultBefore, ownerABefore, feeBalanceBefore] =
        await getMultipleTokenAccounts(program.provider.connection, [
          vaultKey,
          ownerTokenA,
          feeWalletA,
        ]);

      const setupIx = await program.methods
        .liquidatePositionSetup({
          expiration: closeRequestExpiration,
          minTargetAmount: new anchor.BN(0),
          interest: new anchor.BN(10),
          executionFee: new anchor.BN(11),
        })
        .accounts({
          closePositionSetup: {
            pool: shortPoolAKey,
            owner: user2.publicKey,
            currencyVault: shortPoolACurrencyVaultKey,
            position: shortPositionKey,
            permission: liquidateSignerPermission,
            // @ts-ignore
            authority: NON_SWAP_AUTHORITY.publicKey,
          },
        })
        .instruction();
      const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
        [abSwapKey.publicKey.toBuffer()],
        TOKEN_SWAP_PROGRAM_ID
      );
      const swapIx = TokenSwap.swapInstruction(
        abSwapKey.publicKey,
        swapAuthority,
        NON_SWAP_AUTHORITY.publicKey,
        shortPoolAVaultKey,
        swapTokenAccountA,
        swapTokenAccountB,
        shortPoolACurrencyVaultKey,
        poolMint,
        poolFeeAccount,
        null,
        tokenMintA,
        tokenMintB,
        TOKEN_SWAP_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        BigInt(positionBefore.principal.add(new anchor.BN(12)).toString()),
        BigInt(0)
      );
      const _tx = await program.methods
        .liquidatePositionCleanup()
        .accounts({
          closePositionCleanup: {
            owner: user2.publicKey,
            ownerCurrencyAccount: ownerTokenB,
            ownerCollateralAccount: ownerTokenA,
            currencyVault: shortPoolACurrencyVaultKey,
            pool: shortPoolAKey,
            position: shortPositionKey,
            lpVault: lpVaultTokenBKey,
            feeWallet: feeWalletA,
            globalSettings: globalSettingsKey,
          },
        })
        .preInstructions([setupIx, swapIx])
        .transaction();
      const connection = program.provider.connection;
      const lookupAccount = await connection
        .getAddressLookupTable(openPosLut)
        .catch(() => null);
      const message = new anchor.web3.TransactionMessage({
        instructions: _tx.instructions,
        payerKey: program.provider.publicKey!,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      }).compileToV0Message([lookupAccount.value]);

      const tx = new anchor.web3.VersionedTransaction(message);
      await program.provider.sendAndConfirm(tx, [NON_SWAP_AUTHORITY], {
        skipPreflight: true,
      });

      const [
        positionAfter,
        [vaultAfter, ownerAAfter, feeBalanceAfter],
      ] = await Promise.all([
        program.account.position.fetchNullable(shortPositionKey),
        getMultipleTokenAccounts(program.provider.connection, [
          vaultKey,
          ownerTokenA,
          feeWalletA,
        ]),
      ]);

      // Position should be cleaned up
      assert.isNull(positionAfter);

      // should pay back some interest/principal
      const vaultDiff = vaultAfter.amount - vaultBefore.amount;
      assert.ok(vaultDiff > 0);

      // Owner should have received payout
      const ownerADiff = ownerAAfter.amount - ownerABefore.amount;
      assert.ok(ownerADiff > 0);

      // Fees should have been paid
      const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
      assert.ok(feeBalanceDiff > 0);
    });
  });
});