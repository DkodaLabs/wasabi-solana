import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  abSwapKey,
  feeWalletA,
  feeWalletB,
  NON_SWAP_AUTHORITY,
  openPosLut,
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

describe("CloseLongPosition", () => {
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
    program.provider.publicKey,
    false
  );
  const ownerTokenB = getAssociatedTokenAddressSync(
    tokenMintB,
    program.provider.publicKey,
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

  describe("With owned long position", () => {
    const nonce = 0;
    const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("position"),
        program.provider.publicKey.toBuffer(),
        longPoolBKey.toBuffer(),
        lpVaultKey.toBuffer(),
        new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
      ],
      program.programId
    );
    let closeRequestExpiration = new anchor.BN(Date.now() / 1_000 + 60 * 60);

    // should fail when position is not owned by current signer/owner
    describe("Incorrect owner", () => {
      it("should fail", async () => {
        const positionBefore = await program.account.position.fetch(
          positionKey
        );
        const setupIx = await program.methods
          .closeLongPositionSetup({
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
        try {
          const _tx = await program.methods
            .closeLongPositionCleanup()
            .accounts({
              owner: user2.publicKey,
              closePositionCleanup: {
                owner: user2.publicKey,
                ownerCurrencyAccount: ownerTokenA,
                currencyVault: longPoolBCurrencyVaultKey,
                ownerCollateralAccount: ownerTokenB,
                pool: longPoolBKey,
                position: positionKey,
                lpVault: lpVaultKey,
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
          await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY, user2], {
            skipPreflight: false,
          });
          throw new Error("Did not fail");
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
          .closeLongPositionSetup({
            expiration: closeRequestExpiration,
            minTargetAmount: new anchor.BN(0),
            interest: new anchor.BN(10),
            executionFee: new anchor.BN(11),
          })
          .accounts({
            closePositionSetup: {
              pool: longPoolBKey,
              owner: program.provider.publicKey,
              currencyVault: longPoolBCurrencyVaultKey,
              position: positionKey,
              permission: badCoSignerPermission,
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
        try {
          await program.methods
            .closeLongPositionCleanup()
            .accounts({
              closePositionCleanup: {
                owner: program.provider.publicKey,
                ownerCurrencyAccount: ownerTokenA,
                ownerCollateralAccount: ownerTokenB,
                currencyVault: longPoolBCurrencyVaultKey,
                pool: longPoolBKey,
                position: positionKey,
                lpVault: lpVaultKey,
                feeWallet: feeWalletA,
                globalSettings: globalSettingsKey,
              },
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
              executionFee: new anchor.BN(11),
            })
            .accounts({
              closePositionSetup: {
                pool: longPoolBKey,
                owner: program.provider.publicKey,
                currencyVault: longPoolBCurrencyVaultKey,
                position: positionKey,
                permission: coSignerPermission,
                // @ts-ignore
                authority: SWAP_AUTHORITY.publicKey,
              },
            })
            .instruction();
          await program.methods
            .closeLongPositionCleanup()
            .accounts({
              closePositionCleanup: {
                owner: program.provider.publicKey,
                ownerCurrencyAccount: ownerTokenA,
                ownerCollateralAccount: ownerTokenB,
                currencyVault: longPoolBCurrencyVaultKey,
                pool: longPoolBKey,
                position: positionKey,
                lpVault: lpVaultKey,
                feeWallet: feeWalletA,
                globalSettings: globalSettingsKey,
              },
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
              executionFee: new anchor.BN(11),
            })
            .accounts({
              closePositionSetup: {
                pool: longPoolBKey,
                owner: program.provider.publicKey,
                currencyVault: longPoolBCurrencyVaultKey,
                position: positionKey,
                permission: coSignerPermission,
                // @ts-ignore
                authority: SWAP_AUTHORITY.publicKey,
              },
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
        const interestOwed = new anchor.BN(1);
        const closeFee = new anchor.BN(11);
        const positionBefore = await program.account.position.fetch(
          positionKey
        );
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
        const setupIx = await program.methods
          .closeLongPositionSetup({
            expiration: closeRequestExpiration,
            minTargetAmount: new anchor.BN(0),
            interest: interestOwed,
            executionFee: new anchor.BN(11),
          })
          .accounts({
            closePositionSetup: {
              pool: longPoolBKey,
              owner: program.provider.publicKey,
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
          SWAP_AUTHORITY.publicKey, //userTransferAuthority
          longPoolBVaultKey, // userSource
          swapTokenAccountB, // poolSource
          swapTokenAccountA, // poolDestination
          longPoolBCurrencyVaultKey, // userDestination
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
        await program.methods
          .closeLongPositionCleanup()
          .accounts({
            closePositionCleanup: {
              owner: program.provider.publicKey,
              ownerCurrencyAccount: ownerTokenA,
              ownerCollateralAccount: ownerTokenB,
              currencyVault: longPoolBCurrencyVaultKey,
              pool: longPoolBKey,
              position: positionKey,
              lpVault: lpVaultKey,
              feeWallet: feeWalletA,
              globalSettings: globalSettingsKey,
            },
          })
          .preInstructions([setupIx, swapIx])
          .signers([SWAP_AUTHORITY])
          .rpc({ skipPreflight: true });

        const [positionAfter, [vaultAfter, ownerAAfter, feeBalanceAfter]] =
          await Promise.all([
            program.account.position.fetchNullable(positionKey),
            getMultipleTokenAccounts(program.provider.connection, [
              vaultKey,
              ownerTokenA,
              feeWalletA,
            ]),
          ]);
        assert.isNull(positionAfter);

        // should pay back interest + principal to LP Vault
        const expectedLpVaultDiff = positionBefore.principal.add(interestOwed);
        const vaultDiff = vaultAfter.amount - vaultBefore.amount;
        assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString());

        // Validate the user got the rest
        const ownerADiff = ownerAAfter.amount - ownerABefore.amount;
        assert.equal(ownerADiff.toString(), "948");

        const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
        assert.equal(feeBalanceDiff.toString(), closeFee.toString());
      });
    });
  });
});
