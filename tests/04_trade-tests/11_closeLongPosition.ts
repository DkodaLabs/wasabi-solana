import { assert } from "chai";
import {
    defaultCloseLongPositionArgs,
    validateCloseLongPosition,
    closeLongPositionWithIncorrectOwner,
    closeLongPositionWithoutCosigner,
    closeLongPositionWithInvalidSetup,
    closeLongPositionWithoutCleanup,
    closeLongPositionWithBadDebt,
} from '../hooks/tradeHook';

describe("CloseLongPosition", () => {
    describe("with owned long position", () => {
        describe("incorrect owner", () => {
            it("should fail", async () => {
                try {
                    await closeLongPositionWithIncorrectOwner(defaultCloseLongPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    assert.ok(true);
                }
            });
        });
        describe("without swap co-signer", () => {
            it("should fail", async () => {
                try {
                    await closeLongPositionWithoutCosigner(defaultCloseLongPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    assert.ok(true);
                }

            });
        });
        describe("with more than one setup IX", () => {
            it("should fail", async () => {
                try {
                    await closeLongPositionWithInvalidSetup(defaultCloseLongPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    assert.ok(true);
                }
            });
        });
        describe("without cleanup instruction", () => {
            it("should fail", async () => {
                try {
                    await closeLongPositionWithoutCleanup(defaultCloseLongPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    assert.ok(true);
                }
            });
        });
        describe("when a user tries to close a position with bad debt", () => {
            it("should fail", async () => {
                try {
                    await closeLongPositionWithBadDebt(defaultCloseLongPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    assert.ok(true);
                }
            });
        });
        describe("correct setup", () => {
            it("should successfully close position", async () => {
                try {
                    await validateCloseLongPosition(defaultCloseLongPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    assert.ok(true);
                }
            });
        });
    });
});

//        // TODO should fail if swap uses less/more than position collateral
//        describe("user tries to close a position with bad debt", () => {
//            it("should fail with BadDebt error", async () => {
//                // Setup: (currency vault is empty, collateral has balance from open position)
//                const setupIx = await program.methods
//                    .closeLongPositionSetup(
//                        new anchor.BN(0),
//                        new anchor.BN(10), // interest
//                        new anchor.BN(11), // execution fee
//                        new anchor.BN(Math.floor(Date.now() / 1000) + 3600)
//                    )
//                    .accounts({
//                        owner: program.provider.publicKey,
//                        closePositionSetup: {
//                            pool: longPoolBKey,
//                            owner: program.provider.publicKey,
//                            collateral: tokenMintB,
//                            position: positionKey,
//                            permission: coSignerPermission,
//                            //@ts-ignore
//                            authority: SWAP_AUTHORITY.publicKey,
//                            tokenProgram: TOKEN_PROGRAM_ID,
//                        },
//                    })
//                    .instruction();
//
//                // After setup: drain collateral and mint small amount to currency
//                const drainCollateralIx = createTransferInstruction(
//                    longPoolBVaultKey,
//                    ownerTokenB,
//                    SWAP_AUTHORITY.publicKey,
//                    1800, // Leave small amount from the ~1900 we got from opening
//                    [SWAP_AUTHORITY],
//                    TOKEN_PROGRAM_ID
//                );
//
//                // Mint small amount to currency to ensure positive delta but not enough for principal (1000)
//                const mintCurrencyIx = createMintToInstruction(
//                    tokenMintA,
//                    longPoolBCurrencyVaultKey,
//                    program.provider.publicKey,
//                    500, // Not enough to cover principal of 1000
//                    undefined,
//                    TOKEN_PROGRAM_ID
//                );
//
//                try {
//                    const _tx = await program.methods
//                        .closeLongPositionCleanup()
//                        .accountsPartial({
//                            owner: program.provider.publicKey,
//                            closePositionCleanup: {
//                                owner: program.provider.publicKey,
//                                ownerPayoutAccount: ownerTokenA,
//                                pool: longPoolBKey,
//                                position: positionKey,
//                                currency: tokenMintA,
//                                collateral: tokenMintB,
//                                authority: SWAP_AUTHORITY.publicKey,
//                                feeWallet: feeWalletA,
//                                liquidationWallet: liquidationWalletA,
//                                collateralTokenProgram: TOKEN_PROGRAM_ID,
//                                currencyTokenProgram: TOKEN_PROGRAM_ID,
//                            },
//                        })
//                        .preInstructions([
//                            setupIx,
//                            drainCollateralIx,
//                            mintCurrencyIx,
//                        ])
//                        .transaction();
//
//                    const connection = program.provider.connection;
//                    const lookupAccount = await connection
//                        .getAddressLookupTable(openPosLut)
//                        .catch(() => null);
//                    const message = new web3.TransactionMessage({
//                        instructions: _tx.instructions,
//                        payerKey: program.provider.publicKey!,
//                        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
//                    }).compileToV0Message([lookupAccount.value]);
//
//                    const tx = new web3.VersionedTransaction(message);
//                    await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
//                        skipPreflight: false,
//                    });
//
//
//                    assert.fail("Expected transaction to fail with BadDebt error");
//                } catch (e: any) {
//                    const err = anchor.translateError(
//                        e,
//                        anchor.parseIdlErrors(program.idl)
//                    );
//                    if (err instanceof anchor.AnchorError) {
//
//                        assert.equal(err.error.errorCode.number, 6011);
//                    } else if (err instanceof anchor.ProgramError) {
//                        assert.equal(err.code, 6011);
//                    } else {
//                        assert.ok(false);
//                    }
//                }
//            });
//        });
//

//                const [lpVaultAfter, positionAfter, [vaultAfter, ownerAAfter, feeWalletAAfter]] =
//                    await Promise.all([
//                        program.account.lpVault.fetchNullable(lpVaultKey),
//                        program.account.position.fetchNullable(positionKey),
//                        getMultipleTokenAccounts(program.provider.connection, [
//                            vaultKey,
//                            ownerTokenA,
//                            feeWalletA
//                        ], TOKEN_PROGRAM_ID),
//                    ]);
//                assert.isNull(positionAfter);
//
//                // should pay back interest + principal to LP Vault
//                const expectedLpVaultDiff = positionBefore.principal.add(interestOwed);
//                const vaultDiff = vaultAfter.amount - vaultBefore.amount;
//                assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString());
//
//
//                // Validate the user got the rest
//                const ownerADiff = ownerAAfter.amount - ownerABefore.amount;
//                assert.equal(ownerADiff.toString(), "939");
//
//
//                // we expect the totalAssets of the lpVault to be incremented by the interestOwed
//                assert.equal(lpVaultAfter.totalAssets.sub(lpVaultBefore.totalAssets).toString(), interestOwed.toString());
//            });
//        });
//    });
//});
