import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
  abSwapKey,
  feeWalletA,
  openPosLut,
  poolFeeAccount,
  poolMint,
  superAdminProgram,
  SWAP_AUTHORITY,
  swapTokenAccountA,
  swapTokenAccountB,
  tokenAKeypair,
  tokenMintA,
  tokenMintB,
  user2,
} from "./rootHooks";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TOKEN_SWAP_PROGRAM_ID, TokenSwap } from "@solana/spl-token-swap";
import { assert } from "chai";
import { getMultipleTokenAccounts } from "./utils";

describe("takeProfitOrder", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  const [coSignerPermission] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("admin"),
      SWAP_AUTHORITY.publicKey.toBuffer(),
    ],
    program.programId
  );

  const [globalSettingsKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("global_settings")],
    program.programId
  );
  const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
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
  const nonce = 15;
  const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("position"),
      user2.publicKey.toBuffer(),
      longPoolBKey.toBuffer(),
      lpVaultKey.toBuffer(),
      new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
    ],
    program.programId
  );
  const [takeProfitOrderKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("take_profit_order"),
      positionKey.toBuffer(),
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
          lpVault: lpVaultKey,
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
          position: positionKey,
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

    it("should init TP order", async () => {
      const minAmountOut = new anchor.BN(100);
      await program.methods
        .initTakeProfitOrder({
          minAmountOut,
        })
        .accounts({
          trader: user2.publicKey,
          position: positionKey,
        })
        .signers([user2])
        .rpc();
      const takeProfitOrder = await program.account.takeProfitOrder.fetch(
        takeProfitOrderKey
      );
      assert.equal(
        takeProfitOrder.minAmountOut.toString(),
        minAmountOut.toString()
      );
      assert.equal(takeProfitOrder.position.toString(), positionKey.toString());
    });

    it("should close TP order", async () => {
      await program.methods
        .closeTakeProfitOrder()
        .accounts({
          trader: user2.publicKey,
          position: positionKey,
        })
        .signers([user2])
        .rpc();
      const takeProfitOrder =
        await program.account.takeProfitOrder.fetchNullable(takeProfitOrderKey);
      assert.isNull(takeProfitOrder);
    });

    it("should execute TP order", async () => {
      const minAmountOut = new anchor.BN(100);
      const closeRequestExpiration = new anchor.BN(
        Date.now() / 1_000 + 60 * 60
      );
      const positionBefore = await program.account.position.fetch(positionKey);
      const vaultKey = getAssociatedTokenAddressSync(
        positionBefore.currency,
        lpVaultKey,
        true
      );
      const [vaultBefore, ownerABefore, feeBalanceBefore] =
        await getMultipleTokenAccounts(program.provider.connection, [
          vaultKey,
          ownerTokenA,
          feeWalletA,
        ]);

      await program.methods
        .initTakeProfitOrder({
          minAmountOut,
        })
        .accounts({
          trader: user2.publicKey,
          position: positionKey,
        })
        .signers([user2])
        .rpc({ skipPreflight: true });
      const setupIx = await program.methods
        .takeProfitSetup({
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
            position: positionKey,
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
      const _tx = await program.methods
        .takeProfitCleanup()
        .accounts({
          closePositionCleanup: {
            owner: user2.publicKey,
            ownerCurrencyAccount: ownerTokenA,
            ownerCollateralAccount: ownerTokenB,
            currencyVault: longPoolBCurrencyVaultKey,
            pool: longPoolBKey,
            position: positionKey,
            lpVault: lpVaultKey,
            feeWallet: feeWalletA,
            globalSettings: globalSettingsKey,
          },
          takeProfitOrder: takeProfitOrderKey,
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

      const [positionAfter, [vaultAfter, ownerAAfter, feeBalanceAfter]] =
        await Promise.all([
          program.account.position.fetchNullable(positionKey),
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
