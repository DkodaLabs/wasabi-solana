import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
  createMintToCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
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
  tokenBKeypair,
  tokenMintA,
  tokenMintB,
  user2,
} from "./rootHooks";
import { getMultipleTokenAccounts } from "./utils";
import { TOKEN_SWAP_PROGRAM_ID, TokenSwap } from "@solana/spl-token-swap";

describe("CloseShortPosition", () => {
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
    program.programId,
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
  const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
    [abSwapKey.publicKey.toBuffer()],
    TOKEN_SWAP_PROGRAM_ID
  );

  describe("With owned short position", () => {
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
    const closeRequestExpiration = new anchor.BN(Date.now() / 1_000 + 60 * 60);

    // should fail when position is not owned by current signer/owner
    describe("Incorrect owner", () => {
      it("should fail", async () => {
        const positionBefore = await program.account.position.fetch(
          positionKey
        );
        const setupIx = await program.methods
          .closeShortPositionSetup({
            expiration: closeRequestExpiration,
            minTargetAmount: new anchor.BN(0),
            interest: new anchor.BN(10),
            executionFee: new anchor.BN(10),
          })
          .accounts({
            closePositionSetup: {
              pool: shortPoolAKey,
              owner: user2.publicKey,
              ownerCurrencyAccount: ownerTokenB,
              position: positionKey,
              permission: coSignerPermission,
              //@ts-ignore
              authority: SWAP_AUTHORITY.publicKey,
            }
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
          shortPoolAVaultKey,
          swapTokenAccountA,
          swapTokenAccountB,
          ownerTokenB,
          poolMint,
          poolFeeAccount,
          null,
          tokenMintA,
          tokenMintB,
          TOKEN_SWAP_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          BigInt(positionBefore.collateralAmount.toString()),
          BigInt(0)
        );
        try {
          const _tx = await program.methods
            .closeShortPositionCleanup()
            .accounts({
              ownerCollateralAccount: ownerTokenA,
              closePositionCleanup: {
                owner: user2.publicKey,
                ownerCurrencyAccount: ownerTokenB,
                pool: shortPoolAKey,
                position: positionKey,
                lpVault: lpVaultKey,
                feeWallet: feeWalletA,
                globalSettings: globalSettingsKey,
              }
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
        } catch (e) {
          const err = anchor.translateError(e, anchor.parseIdlErrors(program.idl));
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
          positionKey
        );
        const [badCoSignerPermission] =
          anchor.web3.PublicKey.findProgramAddressSync(
            [
              anchor.utils.bytes.utf8.encode("admin"),
              NON_SWAP_AUTHORITY.publicKey.toBuffer(),
            ],
            program.programId
          );

        const setupIx = await program.methods
          .closeShortPositionSetup({
            expiration: closeRequestExpiration,
            minTargetAmount: new anchor.BN(0),
            interest: new anchor.BN(10),
            executionFee: new anchor.BN(10),
          })
          .accounts({
            closePositionSetup: {
              pool: shortPoolAKey,
              owner: program.provider.publicKey,
              ownerCurrencyAccount: ownerTokenB,
              position: positionKey,
              permission: badCoSignerPermission,
              //@ts-ignore
              authority: NON_SWAP_AUTHORITY.publicKey,
            }
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
          shortPoolAVaultKey,
          swapTokenAccountA,
          swapTokenAccountB,
          ownerTokenB,
          poolMint,
          poolFeeAccount,
          null,
          tokenMintA,
          tokenMintB,
          TOKEN_SWAP_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          BigInt(positionBefore.collateralAmount.toString()),
          BigInt(0)
        );
        try {
          await program.methods
            .closeShortPositionCleanup()
            .accounts({
              ownerCollateralAccount: ownerTokenA,
              closePositionCleanup: {
                owner: program.provider.publicKey,
                ownerCurrencyAccount: ownerTokenB,
                pool: shortPoolAKey,
                position: positionKey,
                lpVault: lpVaultKey,
                feeWallet: feeWalletA,
                globalSettings: globalSettingsKey,
              }
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
            .closeShortPositionSetup({
              expiration: closeRequestExpiration,
              minTargetAmount: new anchor.BN(0),
              interest: new anchor.BN(10),
              executionFee: new anchor.BN(10),
            })
            .accounts({
              closePositionSetup: {
                pool: shortPoolAKey,
                owner: program.provider.publicKey,
                ownerCurrencyAccount: ownerTokenB,
                position: positionKey,
                permission: coSignerPermission,
                //@ts-ignore
                authority: SWAP_AUTHORITY.publicKey,
              }
            })
            .instruction();
          await program.methods
            .closeShortPositionCleanup()
            .accounts({
              ownerCollateralAccount: ownerTokenA,
              closePositionCleanup: {
                owner: program.provider.publicKey,
                ownerCurrencyAccount: ownerTokenB,
                pool: shortPoolAKey,
                position: positionKey,
                lpVault: lpVaultKey,
                feeWallet: feeWalletA,
                globalSettings: globalSettingsKey,
              }
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
            .closeShortPositionSetup({
              expiration: closeRequestExpiration,
              minTargetAmount: new anchor.BN(0),
              interest: new anchor.BN(10),
              executionFee: new anchor.BN(10),
            })
            .accounts({
              closePositionSetup: {
                pool: shortPoolAKey,
                owner: program.provider.publicKey,
                ownerCurrencyAccount: ownerTokenB,
                position: positionKey,
                permission: coSignerPermission,
                //@ts-ignore
                authority: SWAP_AUTHORITY.publicKey,
              }
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

    describe("correct setup", () => {
      it("should close the position and return funds", async () => {
        const interestOwed = new anchor.BN(1);
        const closeExecutionFee = new anchor.BN(10);
        const positionBefore = await program.account.position.fetch(
          positionKey
        );
        const vaultKey = getAssociatedTokenAddressSync(
          positionBefore.currency,
          lpVaultKey,
          true
        );
        const [vaultBefore, ownerTokenABefore, ownerBBefore, feeBalanceBefore] = await getMultipleTokenAccounts(
          program.provider.connection,
          [vaultKey, ownerTokenA, ownerTokenB, feeWalletA]
        );
        const setupIx = await program.methods
          .closeShortPositionSetup({
            expiration: closeRequestExpiration,
            minTargetAmount: new anchor.BN(0),
            interest: interestOwed,
            executionFee: closeExecutionFee,
          })
          .accounts({
            closePositionSetup: {
              pool: shortPoolAKey,
              owner: program.provider.publicKey,
              ownerCurrencyAccount: ownerTokenB,
              position: positionKey,
              permission: coSignerPermission,
              //@ts-ignore
              authority: SWAP_AUTHORITY.publicKey,
            }
          })
          .instruction();
        // Hacking the "swap" by appending a mint IX the exact amount needed to pay
        // back interest and principal.
        const mintTokenBToOwnerIx = createMintToCheckedInstruction(
          tokenBKeypair.publicKey,
          ownerTokenB,
          program.provider.publicKey,
          11,
          6
        );
        const swapIx = TokenSwap.swapInstruction(
          abSwapKey.publicKey,
          swapAuthority,
          program.provider.publicKey,
          shortPoolAVaultKey,
          swapTokenAccountA,
          swapTokenAccountB,
          ownerTokenB,
          poolMint,
          poolFeeAccount,
          null,
          tokenMintA,
          tokenMintB,
          TOKEN_SWAP_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          BigInt(positionBefore.principal.toString()),
          BigInt(0)
        );
        await program.methods
          .closeShortPositionCleanup()
          .accounts({
            ownerCollateralAccount: ownerTokenA,
            closePositionCleanup: {
              owner: program.provider.publicKey,
              ownerCurrencyAccount: ownerTokenB,
              pool: shortPoolAKey,
              position: positionKey,
              lpVault: lpVaultKey,
              feeWallet: feeWalletA,
              globalSettings: globalSettingsKey,
            }
          })
          .preInstructions([setupIx, swapIx, mintTokenBToOwnerIx])
          .signers([SWAP_AUTHORITY])
          .rpc({ skipPreflight: true });

        const [positionAfter, [vaultAfter, ownerTokenAAfter, ownerBAfter, feeBalanceAfter]] = await Promise.all([
          program.account.position.fetchNullable(positionKey),
          getMultipleTokenAccounts(program.provider.connection, [
            vaultKey,
            ownerTokenA,
            ownerTokenB,
            feeWalletA,
          ]),
        ]);
        assert.isNull(positionAfter);

        // should pay back interest + principal to LP Vault
        const expectedLpVaultDiff = positionBefore.principal.add(interestOwed);
        const vaultDiff = vaultAfter.amount - vaultBefore.amount;
        assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString());

        // Assert user does not receive payout in tokenB
        const ownerBDiff = ownerBAfter.amount - ownerBBefore.amount;
        assert.equal(ownerBDiff, BigInt(0));

        // Assert user receives payout in tokenA
        const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
        assert.equal(ownerADiff, BigInt(979));

        const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
        assert.equal(feeBalanceDiff.toString(), closeExecutionFee.toString());
      });
    });
  });
});
