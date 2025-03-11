import { assert } from "chai";
import {
    initTakeProfitOrder,
    validateExecuteTakeProfitOrder,
    cancelTakeProfitOrderWithInvalidPermission,
    cancelTakeProfitOrderWithUser,
    cancelTakeProfitOrderWithAdmin,
    executeTakeProfitOrderWithInvalidAuthority,
    executeTakeProfitOrderWithInvalidTakerAmount
} from '../hooks/orderHook';

describe("TakeProfit", () => {
    describe("Long position", () => {
        it("should init the TP order", async () => {
            await initTakeProfitOrder();
        });
        it("should fail to close the TP order without proper permissions", async () => {
            await cancelTakeProfitOrderWithInvalidPermission();
        });
        it("should close the TP order when invoked by the user", async () => {
            await cancelTakeProfitOrderWithUser();
        });
        it("should close the TP order when invoked by the admin", async () => {
            await cancelTakeProfitOrderWithAdmin();
        });
        it("should fail when the authority cannot co-sign swaps", async () => {
            await executeTakeProfitOrderWithInvalidAuthority();
        });
        it("should fail when the TP taker amount is exceeded", async () => {
            await executeTakeProfitOrderWithInvalidTakerAmount();
        });
        it("should execute TP order", async () => {
            await validateExecuteTakeProfitOrder();
        });
    });
    describe("Short position", () => {
        it("should init the TP order", async () => {
            await initTakeProfitOrder();
        });
        it("should fail to close the TP order without proper permissions", async () => {
            await cancelTakeProfitOrderWithInvalidPermission();
        });
        it("should close the TP order when invoked by the user", async () => {
            await cancelTakeProfitOrderWithUser();
        });
        it("should close the TP order when invoked by the admin", async () => {
            await cancelTakeProfitOrderWithAdmin();
        });
        it("should fail when the authority cannot co-sign swaps", async () => {
            await executeTakeProfitOrderWithInvalidAuthority();
        });
        it("should fail when the TP taker amount is exceeded", async () => {
            await executeTakeProfitOrderWithInvalidTakerAmount();
        });
        it("should execute TP order", async () => {
            await validateExecuteTakeProfitOrder();
        });
    });
});

//describe("takeProfitOrder", () => {
//        it("should init TP order", async () => {
//            const makerAmount = new anchor.BN(100);
//            const takerAmount = new anchor.BN(200);
//            await program.methods
//                .initOrUpdateTakeProfitOrder(
//                    makerAmount,
//                    takerAmount,
//                )
//                .accounts({
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    position: longPositionKey,
//                })
//                .signers([user2])
//                .rpc();
//            const takeProfitOrder = await program.account.takeProfitOrder.fetch(
//                longTakeProfitOrderKey
//            );
//            assert.equal(
//                takeProfitOrder.makerAmount.toString(),
//                makerAmount.toString()
//            );
//            assert.equal(
//                takeProfitOrder.takerAmount.toString(),
//                takerAmount.toString()
//            );
//            assert.equal(
//                takeProfitOrder.position.toString(),
//                longPositionKey.toString()
//            );
//        });
//
//        it("should fail to close TP order without proper permissions", async () => {
//            const [adminKey] = anchor.web3.PublicKey.findProgramAddressSync(
//                [anchor.utils.bytes.utf8.encode("admin"), NON_SWAP_AUTHORITY.publicKey.toBuffer()],
//                superAdminProgram.programId,
//            );
//            try {
//                await program.methods
//                    .closeTakeProfitOrder()
//                    .accounts({
//                        closer: SWAP_AUTHORITY.publicKey,
//                        //@ts-ignore
//                        trader: user2.publicKey,
//                        permission: adminKey,
//                        position: longPositionKey,
//                    })
//                    .signers([SWAP_AUTHORITY])
//                    .rpc();
//                throw new Error("Should fail");
//            } catch (e: any) {
//                const err = anchor.translateError(
//                    e,
//                    anchor.parseIdlErrors(program.idl)
//                );
//                if (err instanceof anchor.AnchorError) {
//                    assert.equal(err.error.errorCode.number, 6000);
//                } else if (err instanceof anchor.ProgramError) {
//                    assert.equal(err.code, 6000);
//                } else {
//                    assert.ok(false);
//                }
//            }
//        });
//
//        it("should close TP order with user", async () => {
//            const [adminKey] = anchor.web3.PublicKey.findProgramAddressSync(
//                [anchor.utils.bytes.utf8.encode("admin"), NON_SWAP_AUTHORITY.publicKey.toBuffer()],
//                superAdminProgram.programId,
//            );
//            await program.methods
//                .closeTakeProfitOrder()
//                .accounts({
//                    closer: user2.publicKey,
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    permission: adminKey,
//                    position: longPositionKey,
//                })
//                .signers([user2])
//                .rpc();
//            const takeProfitOrder =
//                await program.account.takeProfitOrder.fetchNullable(
//                    longTakeProfitOrderKey
//                );
//            assert.isNull(takeProfitOrder);
//        });
//
//        it("should close TP order with admin", async () => {
//            const makerAmount = new anchor.BN(100);
//            const takerAmount = new anchor.BN(200);
//            await program.methods
//                .initOrUpdateTakeProfitOrder(
//                    makerAmount,
//                    takerAmount,
//                )
//                .accounts({
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    position: longPositionKey,
//                })
//                .signers([user2])
//                .rpc();
//
//            const [adminKey] = anchor.web3.PublicKey.findProgramAddressSync(
//                [anchor.utils.bytes.utf8.encode("admin"), NON_SWAP_AUTHORITY.publicKey.toBuffer()],
//                superAdminProgram.programId,
//            );
//            await program.methods
//                .closeTakeProfitOrder()
//                .accounts({
//                    closer: NON_SWAP_AUTHORITY.publicKey,
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    permission: adminKey,
//                    position: longPositionKey,
//                })
//                .signers([NON_SWAP_AUTHORITY])
//                .rpc();
//            const takeProfitOrder = await program.account.takeProfitOrder.fetchNullable(
//                longTakeProfitOrderKey
//            );
//            assert.isNull(takeProfitOrder);
//        });
//
//        it("Should fail when authority cannot co-sign swaps", async () => {
//            const makerAmount = new anchor.BN(100);
//            const takerAmount = new anchor.BN(2_000_000);
//            const closeRequestExpiration = new anchor.BN(
//                Date.now() / 1_000 + 60 * 60
//            );
//            const positionBefore = await program.account.position.fetch(
//                longPositionKey
//            );
//
//            await program.methods
//                .initOrUpdateTakeProfitOrder(
//                    makerAmount,
//                    takerAmount,
//                )
//                .accounts({
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    position: longPositionKey,
//                })
//                .signers([user2])
//                .rpc({ skipPreflight: true });
//
//            const args = {
//                minTargetAmount: new anchor.BN(0),
//                interest: new anchor.BN(10),
//                executionFee: new anchor.BN(11),
//                expiration: closeRequestExpiration,
//            };
//
//            const setupIx = await program.methods
//                .takeProfitSetup(
//                    args.minTargetAmount,
//                    args.interest,
//                    args.executionFee,
//                    args.expiration,
//                )
//                .accountsPartial({
//                    closePositionSetup: {
//                        owner: user2.publicKey,
//                        position: longPositionKey,
//                        pool: longPoolBKey,
//                        collateral: tokenMintB,
//                        authority: NON_SWAP_AUTHORITY.publicKey,
//                        permission: nonSwapAuthSignerPermission,
//                        tokenProgram: TOKEN_PROGRAM_ID,
//                    },
//                })
//                .instruction();
//            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                [abSwapKey.publicKey.toBuffer()],
//                TOKEN_SWAP_PROGRAM_ID
//            );
//            const swapIx = TokenSwap.swapInstruction(
//                abSwapKey.publicKey,
//                swapAuthority,
//                NON_SWAP_AUTHORITY.publicKey,
//                longPoolBVaultKey,
//                swapTokenAccountB,
//                swapTokenAccountA,
//                longPoolBCurrencyVaultKey,
//                poolMint,
//                poolFeeAccount,
//                null,
//                tokenMintB,
//                tokenMintA,
//                TOKEN_SWAP_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                BigInt(positionBefore.collateralAmount.toString()),
//                BigInt(0)
//            );
//            try {
//                const _tx = await program.methods
//                    .takeProfitCleanup()
//                    .accountsPartial({
//                        closePositionCleanup: {
//                            owner: user2.publicKey,
//                            ownerPayoutAccount: ownerTokenA,
//                            position: longPositionKey,
//                            pool: longPoolBKey,
//                            currency: tokenMintA,
//                            collateral: tokenMintB,
//                            authority: NON_SWAP_AUTHORITY.publicKey,
//                            lpVault: lpVaultTokenAKey,
//                            feeWallet,
//                            liquidationWallet,
//                            currencyTokenProgram: TOKEN_PROGRAM_ID,
//                            collateralTokenProgram: TOKEN_PROGRAM_ID,
//                        },
//                        takeProfitOrder: longTakeProfitOrderKey,
//                    })
//                    .preInstructions([setupIx, swapIx])
//                    .transaction();
//                const connection = program.provider.connection;
//                const lookupAccount = await connection
//                    .getAddressLookupTable(openPosLut)
//                    .catch(() => null);
//                const message = new anchor.web3.TransactionMessage({
//                    instructions: _tx.instructions,
//                    payerKey: program.provider.publicKey!,
//                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
//                }).compileToV0Message([lookupAccount.value]);
//
//                const tx = new anchor.web3.VersionedTransaction(message);
//                await program.provider.sendAndConfirm(tx, [NON_SWAP_AUTHORITY], {
//                    skipPreflight: true,
//                });
//                throw new Error("Failed to error");
//            } catch (e: any) {
//                const err = anchor.translateError(
//                    e,
//                    anchor.parseIdlErrors(program.idl)
//                );
//                if (err instanceof anchor.AnchorError) {
//                    assert.equal(err.error.errorCode.number, 6000);
//                } else if (err instanceof anchor.ProgramError) {
//                    assert.equal(err.code, 6000);
//                } else {
//                    assert.ok(false);
//                }
//            }
//
//            await program.methods
//                .closeTakeProfitOrder()
//                .accounts({
//                    closer: user2.publicKey,
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    permission: coSignerPermission,
//                    position: longPositionKey,
//                })
//                .signers([user2])
//                .rpc({ skipPreflight: true });
//        });
//
//        it("Should fail when the TP taker amount is not met", async () => {
//            const makerAmount = new anchor.BN(100);
//            const takerAmount = new anchor.BN(2_000_000);
//            const closeRequestExpiration = new anchor.BN(
//                Date.now() / 1_000 + 60 * 60
//            );
//            const positionBefore = await program.account.position.fetch(
//                longPositionKey
//            );
//
//            await program.methods
//                .initOrUpdateTakeProfitOrder(
//                    makerAmount,
//                    takerAmount,
//                )
//                .accounts({
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    position: longPositionKey,
//                })
//                .signers([user2])
//                .rpc({ skipPreflight: true });
//            const args = {
//                minTargetAmount: new anchor.BN(0),
//                interest: new anchor.BN(10),
//                executionFee: new anchor.BN(11),
//                expiration: closeRequestExpiration,
//            };
//            const setupIx = await program.methods
//                .takeProfitSetup(
//                    args.minTargetAmount,
//                    args.interest,
//                    args.executionFee,
//                    args.expiration,
//                )
//                .accounts({
//                    closePositionSetup: {
//                        owner: user2.publicKey,
//                        position: longPositionKey,
//                        pool: longPoolBKey,
//                        collateral: tokenMintA,
//                        // @ts-ignore
//                        authority: SWAP_AUTHORITY.publicKey,
//                        permission: coSignerPermission,
//                        tokenProgram: TOKEN_PROGRAM_ID,
//                    },
//                })
//                .instruction();
//            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                [abSwapKey.publicKey.toBuffer()],
//                TOKEN_SWAP_PROGRAM_ID
//            );
//            const swapIx = TokenSwap.swapInstruction(
//                abSwapKey.publicKey,
//                swapAuthority,
//                SWAP_AUTHORITY.publicKey,
//                longPoolBVaultKey,
//                swapTokenAccountB,
//                swapTokenAccountA,
//                longPoolBCurrencyVaultKey,
//                poolMint,
//                poolFeeAccount,
//                null,
//                tokenMintB,
//                tokenMintA,
//                TOKEN_SWAP_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                BigInt(positionBefore.collateralAmount.toString()),
//                BigInt(0)
//            );
//            try {
//                const _tx = await program.methods
//                    .takeProfitCleanup()
//                    .accountsPartial({
//                        closePositionCleanup: {
//                            owner: user2.publicKey,
//                            ownerPayoutAccount: ownerTokenA,
//                            position: longPositionKey,
//                            pool: longPoolBKey,
//                            currency: tokenMintA,
//                            collateral: tokenMintB,
//                            authority: SWAP_AUTHORITY.publicKey,
//                            lpVault: lpVaultTokenAKey,
//                            feeWallet,
//                            liquidationWallet,
//                            collateralTokenProgram: TOKEN_PROGRAM_ID,
//                            currencyTokenProgram: TOKEN_PROGRAM_ID,
//                        },
//                        takeProfitOrder: longTakeProfitOrderKey,
//                    })
//                    .preInstructions([setupIx, swapIx])
//                    .transaction();
//                const connection = program.provider.connection;
//                const lookupAccount = await connection
//                    .getAddressLookupTable(openPosLut)
//                    .catch(() => null);
//                const message = new anchor.web3.TransactionMessage({
//                    instructions: _tx.instructions,
//                    payerKey: program.provider.publicKey!,
//                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
//                }).compileToV0Message([lookupAccount.value]);
//
//                const tx = new anchor.web3.VersionedTransaction(message);
//                await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
//                    skipPreflight: true,
//                });
//                throw new Error("Failed to error");
//            } catch (e: any) {
//                const err = anchor.translateError(
//                    e,
//                    anchor.parseIdlErrors(program.idl)
//                );
//                if (err instanceof anchor.AnchorError) {
//                    assert.equal(err.error.errorCode.number, 6017);
//                } else if (err instanceof anchor.ProgramError) {
//                    assert.equal(err.code, 6017);
//                } else {
//                    assert.ok(false);
//                }
//            }
//
//            // must close the TP order so new ones can be created on the existing position
//            await program.methods
//                .closeTakeProfitOrder()
//                .accounts({
//                    closer: user2.publicKey,
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    permission: coSignerPermission,
//                    position: longPositionKey,
//                })
//                .signers([user2])
//                .rpc({ skipPreflight: true });
//        });
//
//        it("should execute TP order", async () => {
//            const makerAmount = new anchor.BN(100);
//            const takerAmount = new anchor.BN(200);
//            const closeRequestExpiration = new anchor.BN(
//                Date.now() / 1_000 + 60 * 60
//            );
//            const positionBefore = await program.account.position.fetch(
//                longPositionKey
//            );
//            const vaultKey = getAssociatedTokenAddressSync(
//                positionBefore.currency,
//                lpVaultTokenAKey,
//                true
//            );
//            const [vaultBefore, ownerABefore, feeBalanceBefore] =
//                await getMultipleTokenAccounts(program.provider.connection, [
//                    vaultKey,
//                    ownerTokenA,
//                    feeWallet,
//                ], TOKEN_PROGRAM_ID);
//
//            await program.methods
//                .initOrUpdateTakeProfitOrder(
//                    makerAmount,
//                    takerAmount,
//                )
//                .accounts({
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    position: longPositionKey,
//                })
//                .signers([user2])
//                .rpc({ skipPreflight: true });
//            const args = {
//                minTargetAmount: new anchor.BN(0),
//                interest: new anchor.BN(10),
//                executionFee: new anchor.BN(11),
//                expiration: closeRequestExpiration,
//            };
//            const setupIx = await program.methods
//                .takeProfitSetup(
//                    args.minTargetAmount,
//                    args.interest,
//                    args.executionFee,
//                    args.expiration,
//                )
//                .accounts({
//                    closePositionSetup: {
//                        pool: longPoolBKey,
//                        owner: user2.publicKey,
//                        collateral: tokenMintB,
//                        position: longPositionKey,
//                        permission: coSignerPermission,
//                        // @ts-ignore
//                        authority: SWAP_AUTHORITY.publicKey,
//                        tokenProgram: TOKEN_PROGRAM_ID,
//                    },
//                })
//                .instruction();
//            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                [abSwapKey.publicKey.toBuffer()],
//                TOKEN_SWAP_PROGRAM_ID
//            );
//            const swapIx = TokenSwap.swapInstruction(
//                abSwapKey.publicKey,
//                swapAuthority,
//                SWAP_AUTHORITY.publicKey,
//                longPoolBVaultKey,
//                swapTokenAccountB,
//                swapTokenAccountA,
//                longPoolBCurrencyVaultKey,
//                poolMint,
//                poolFeeAccount,
//                null,
//                tokenMintB,
//                tokenMintA,
//                TOKEN_SWAP_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                BigInt(positionBefore.collateralAmount.toString()),
//                BigInt(0)
//            );
//            const _tx = await program.methods
//                .takeProfitCleanup()
//                .accountsPartial({
//                    closePositionCleanup: {
//                        owner: user2.publicKey,
//                        ownerPayoutAccount: ownerTokenA,
//                        pool: longPoolBKey,
//                        position: longPositionKey,
//                        currency: tokenMintA,
//                        collateral: tokenMintB,
//                        authority: SWAP_AUTHORITY.publicKey,
//                        feeWallet,
//                        liquidationWallet,
//                        currencyTokenProgram: TOKEN_PROGRAM_ID,
//                        collateralTokenProgram: TOKEN_PROGRAM_ID,
//                    },
//                    takeProfitOrder: longTakeProfitOrderKey,
//                })
//                .preInstructions([setupIx, swapIx])
//                .transaction();
//
//            const connection = program.provider.connection;
//            const lookupAccount = await connection
//                .getAddressLookupTable(openPosLut)
//                .catch(() => null);
//            const message = new anchor.web3.TransactionMessage({
//                instructions: _tx.instructions,
//                payerKey: program.provider.publicKey!,
//                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
//            }).compileToV0Message([lookupAccount.value]);
//
//            const tx = new anchor.web3.VersionedTransaction(message);
//            await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
//                skipPreflight: true,
//            });
//
//            const [
//                takerProfitOrderAfter,
//                positionAfter,
//                [vaultAfter, ownerAAfter, feeBalanceAfter],
//            ] = await Promise.all([
//                program.account.takeProfitOrder.fetchNullable(longTakeProfitOrderKey),
//                program.account.position.fetchNullable(longPositionKey),
//                getMultipleTokenAccounts(program.provider.connection, [
//                    vaultKey,
//                    ownerTokenA,
//                    feeWallet,
//                ], TOKEN_PROGRAM_ID),
//            ]);
//            // Position should be cleaned up
//            assert.isNull(positionAfter);
//
//            // TP order should be closed
//            assert.isNull(takerProfitOrderAfter);
//
//            // should pay back some interest/principal
//            const vaultDiff = vaultAfter.amount - vaultBefore.amount;
//            assert.ok(vaultDiff > 0);
//
//            // Owner should have received payout
//            const ownerADiff = ownerAAfter.amount - ownerABefore.amount;
//            assert.ok(ownerADiff > 0);
//
//            // Fees should have been paid
//            const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
//            assert.ok(feeBalanceDiff > 0);
//        });
//    });
//
//    describe("Short", () => {
//        before(async () => {
//            const fee = new anchor.BN(10);
//            const now = new Date().getTime() / 1_000;
//            const downPayment = new anchor.BN(1_000);
//            // amount to be borrowed
//            const principal = new anchor.BN(1_000);
//            const swapAmount = principal;
//            const minTargetAmount = new anchor.BN(1);
//            const args = {
//                nonce,
//                minTargetAmount,
//                downPayment,
//                principal,
//                fee,
//                expiration: new anchor.BN(now + 3_600),
//            };
//            const setupIx = await program.methods
//                .openShortPositionSetup(
//                    args.nonce,
//                    args.minTargetAmount,
//                    args.downPayment,
//                    args.principal,
//                    args.fee,
//                    args.expiration,
//                )
//                .accounts({
//                    owner: user2.publicKey,
//                    lpVault: lpVaultTokenBKey,
//                    pool: shortPoolAKey,
//                    currency: tokenMintB,
//                    collateral: tokenMintA,
//                    permission: coSignerPermission,
//                    //@ts-ignore
//                    authority: SWAP_AUTHORITY.publicKey,
//                    feeWallet,
//                    currencyTokenProgram: TOKEN_PROGRAM_ID,
//                    collateralTokenProgram: TOKEN_PROGRAM_ID,
//                })
//                .instruction();
//            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                [abSwapKey.publicKey.toBuffer()],
//                TOKEN_SWAP_PROGRAM_ID
//            );
//            const swapIx = TokenSwap.swapInstruction(
//                abSwapKey.publicKey,
//                swapAuthority,
//                SWAP_AUTHORITY.publicKey,
//                shortPoolACurrencyVaultKey,
//                swapTokenAccountB,
//                swapTokenAccountA,
//                shortPoolAVaultKey,
//                poolMint,
//                poolFeeAccount,
//                null,
//                tokenMintB,
//                tokenMintA,
//                TOKEN_SWAP_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                BigInt(swapAmount.toString()),
//                BigInt(minTargetAmount.toString())
//            );
//            const _tx = await program.methods
//                .openShortPositionCleanup()
//                .accounts({
//                    owner: user2.publicKey,
//                    pool: shortPoolAKey,
//                    position: shortPositionKey,
//                    //@ts-ignore
//                    lpVault: lpVaultTokenBKey,
//                    collateral: tokenMintA,
//                    currency: tokenMintB,
//                    tokenProgram: TOKEN_PROGRAM_ID,
//                })
//                .preInstructions([setupIx, swapIx])
//                .transaction();
//
//            const connection = program.provider.connection;
//            const lookupAccount = await connection
//                .getAddressLookupTable(openPosLut)
//                .catch(() => null);
//            const message = new anchor.web3.TransactionMessage({
//                instructions: _tx.instructions,
//                payerKey: program.provider.publicKey!,
//                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
//            }).compileToV0Message([lookupAccount.value]);
//
//            const tx = new anchor.web3.VersionedTransaction(message);
//            await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY, user2], {
//                skipPreflight: true,
//            });
//        });
//
//        it("Should fail when the TP taker amount is not met", async () => {
//            // very low price 0.0001
//            const makerAmount = new anchor.BN(1);
//            const takerAmount = new anchor.BN(1_000);
//            const closeRequestExpiration = new anchor.BN(
//                Date.now() / 1_000 + 60 * 60
//            );
//            const positionBefore = await program.account.position.fetch(
//                shortPositionKey
//            );
//
//            await program.methods
//                .initOrUpdateTakeProfitOrder(
//                    makerAmount,
//                    takerAmount,
//                )
//                .accounts({
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    position: shortPositionKey,
//                })
//                .signers([user2])
//                .rpc({ skipPreflight: true });
//            const args = {
//                minTargetAmount: new anchor.BN(0),
//                interest: new anchor.BN(10),
//                executionFee: new anchor.BN(11),
//                expiration: closeRequestExpiration,
//            };
//            const setupIx = await program.methods
//                .takeProfitSetup(
//                    args.minTargetAmount,
//                    args.interest,
//                    args.executionFee,
//                    args.expiration,
//                )
//                .accounts({
//                    closePositionSetup: {
//                        pool: shortPoolAKey,
//                        owner: user2.publicKey,
//                        collateral: tokenMintA,
//                        position: shortPositionKey,
//                        permission: coSignerPermission,
//                        // @ts-ignore
//                        authority: SWAP_AUTHORITY.publicKey,
//                        tokenProgram: TOKEN_PROGRAM_ID,
//                    },
//                })
//                .instruction();
//            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                [abSwapKey.publicKey.toBuffer()],
//                TOKEN_SWAP_PROGRAM_ID
//            );
//            const swapIx = TokenSwap.swapInstruction(
//                abSwapKey.publicKey,
//                swapAuthority,
//                SWAP_AUTHORITY.publicKey,
//                shortPoolAVaultKey,
//                swapTokenAccountA,
//                swapTokenAccountB,
//                shortPoolACurrencyVaultKey,
//                poolMint,
//                poolFeeAccount,
//                null,
//                tokenMintA,
//                tokenMintB,
//                TOKEN_SWAP_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                BigInt(positionBefore.principal.add(new anchor.BN(12)).toString()),
//                BigInt(0)
//            );
//            try {
//                const _tx = await program.methods
//                    .takeProfitCleanup()
//                    .accounts({
//                        closePositionCleanup: {
//                            //@ts-ignore
//                            owner: user2.publicKey,
//                            ownerPayoutAccount: ownerTokenA,
//                            pool: shortPoolAKey,
//                            position: shortPositionKey,
//                            currency: tokenMintB,
//                            collateral: tokenMintA,
//                            //@ts-ignore
//                            feeWallet,
//                            liquidationWallet,
//                            authority: SWAP_AUTHORITY.publicKey,
//                            currencyTokenProgram: TOKEN_PROGRAM_ID,
//                            collateralTokenProgram: TOKEN_PROGRAM_ID,
//                        },
//                        //@ts-ignore
//                        takeProfitOrder: shortTakeProfitOrderKey,
//                    })
//                    .preInstructions([setupIx, swapIx])
//                    .transaction();
//                const connection = program.provider.connection;
//                const lookupAccount = await connection
//                    .getAddressLookupTable(openPosLut)
//                    .catch(() => null);
//                const message = new anchor.web3.TransactionMessage({
//                    instructions: _tx.instructions,
//                    payerKey: program.provider.publicKey!,
//                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
//                }).compileToV0Message([lookupAccount.value]);
//
//                const tx = new anchor.web3.VersionedTransaction(message);
//                await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
//                    skipPreflight: true,
//                });
//                throw new Error("Failed to error");
//            } catch (e: any) {
//                if (e.message && e.message.includes('{"Custom":6017}')) {
//                    return;
//                }
//                const err = anchor.translateError(
//                    e,
//                    anchor.parseIdlErrors(program.idl)
//                );
//                if (err instanceof anchor.AnchorError) {
//                    assert.equal(err.error.errorCode.number, 6017);
//                } else if (err instanceof anchor.ProgramError) {
//                    assert.equal(err.code, 6017);
//                } else {
//                    assert.ok(false);
//                }
//            }
//
//            // must close the TP order so new ones can be created on the existing position
//            await program.methods
//                .closeTakeProfitOrder()
//                .accounts({
//                    closer: user2.publicKey,
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    permission: user2.publicKey,
//                    position: shortPositionKey,
//                })
//                .signers([user2])
//                .rpc({ skipPreflight: true });
//        });
//
//        it("Should execute the TP order", async () => {
//            // high price of 2
//            const makerAmount = new anchor.BN(2_000);
//            const takerAmount = new anchor.BN(1_000);
//            const closeRequestExpiration = new anchor.BN(
//                Date.now() / 1_000 + 60 * 60
//            );
//            const positionBefore = await program.account.position.fetch(
//                shortPositionKey
//            );
//            const vaultKey = getAssociatedTokenAddressSync(
//                positionBefore.currency,
//                lpVaultTokenBKey,
//                true
//            );
//            const [vaultBefore, ownerABefore, feeBalanceBefore] =
//                await getMultipleTokenAccounts(program.provider.connection, [
//                    vaultKey,
//                    ownerTokenA,
//                    feeWallet,
//                ], TOKEN_PROGRAM_ID);
//
//            await program.methods
//                .initOrUpdateTakeProfitOrder(
//                    makerAmount,
//                    takerAmount,
//                )
//                .accounts({
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    position: shortPositionKey,
//                })
//                .signers([user2])
//                .rpc({ skipPreflight: true });
//            const args = {
//                minTargetAmount: new anchor.BN(0),
//                interest: new anchor.BN(10),
//                executionFee: new anchor.BN(11),
//                expiration: closeRequestExpiration,
//            };
//            const setupIx = await program.methods
//                .takeProfitSetup(
//                    args.minTargetAmount,
//                    args.interest,
//                    args.executionFee,
//                    args.expiration,
//                )
//                .accounts({
//                    closePositionSetup: {
//                        pool: shortPoolAKey,
//                        owner: user2.publicKey,
//                        collateral: tokenMintA,
//                        position: shortPositionKey,
//                        permission: coSignerPermission,
//                        // @ts-ignore
//                        authority: SWAP_AUTHORITY.publicKey,
//                        tokenProgram: TOKEN_PROGRAM_ID,
//                    },
//                })
//                .instruction();
//            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                [abSwapKey.publicKey.toBuffer()],
//                TOKEN_SWAP_PROGRAM_ID
//            );
//            const swapIx = TokenSwap.swapInstruction(
//                abSwapKey.publicKey,
//                swapAuthority,
//                SWAP_AUTHORITY.publicKey,
//                shortPoolAVaultKey,
//                swapTokenAccountA,
//                swapTokenAccountB,
//                shortPoolACurrencyVaultKey,
//                poolMint,
//                poolFeeAccount,
//                null,
//                tokenMintA,
//                tokenMintB,
//                TOKEN_SWAP_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                BigInt(positionBefore.principal.add(new anchor.BN(12)).toString()),
//                BigInt(0)
//            );
//            const _tx = await program.methods
//                .takeProfitCleanup()
//                .accounts({
//                    closePositionCleanup: {
//                        //@ts-ignore
//                        owner: user2.publicKey,
//                        ownerPayoutAccount: ownerTokenA,
//                        pool: shortPoolAKey,
//                        position: shortPositionKey,
//                        currency: tokenMintB,
//                        collateral: tokenMintA,
//                        authority: SWAP_AUTHORITY.publicKey,
//                        //@ts-ignore
//                        feeWallet,
//                        liquidationWallet,
//                        currencyTokenProgram: TOKEN_PROGRAM_ID,
//                        collateralTokenProgram: TOKEN_PROGRAM_ID,
//                    },
//                    //@ts-ignore
//                    takeProfitOrder: shortTakeProfitOrderKey,
//                })
//                .preInstructions([setupIx, swapIx])
//                .transaction();
//            const connection = program.provider.connection;
//            const lookupAccount = await connection
//                .getAddressLookupTable(openPosLut)
//                .catch(() => null);
//            const message = new anchor.web3.TransactionMessage({
//                instructions: _tx.instructions,
//                payerKey: program.provider.publicKey!,
//                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
//            }).compileToV0Message([lookupAccount.value]);
//
//            const tx = new anchor.web3.VersionedTransaction(message);
//            await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
//                skipPreflight: true,
//            });
//
//            const [
//                takerProfitOrderAfter,
//                positionAfter,
//                [vaultAfter, ownerAAfter, feeBalanceAfter],
//            ] = await Promise.all([
//                program.account.takeProfitOrder.fetchNullable(shortTakeProfitOrderKey),
//                program.account.position.fetchNullable(shortPositionKey),
//                getMultipleTokenAccounts(program.provider.connection, [
//                    vaultKey,
//                    ownerTokenA,
//                    feeWallet,
//                ], TOKEN_PROGRAM_ID),
//            ]);
//
//            // Position should be cleaned up
//            assert.isNull(positionAfter);
//
//            // TP order should be closed
//            assert.isNull(takerProfitOrderAfter);
//
//            // should pay back some interest/principal
//            const vaultDiff = vaultAfter.amount - vaultBefore.amount;
//            assert.ok(vaultDiff > 0);
//
//            // Owner should have received payout
//            const ownerADiff = ownerAAfter.amount - ownerABefore.amount;
//            assert.ok(ownerADiff > 0);
//
//            // Fees should have been paid
//            const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
//            assert.ok(feeBalanceDiff > 0);
//        });
//    });
//    describe("Long /w SL", () => {
//        before(async () => {
//            // Create Long position that will have a TP order
//            const fee = new anchor.BN(10);
//            const now = new Date().getTime() / 1_000;
//
//            const downPayment = new anchor.BN(1_000);
//            // amount to be borrowed
//            const principal = new anchor.BN(1_000);
//            const swapAmount = downPayment.add(principal);
//            const minimumAmountOut = new anchor.BN(1_900);
//
//            const args = {
//                nonce,
//                minTargetAmount: minimumAmountOut,
//                downPayment,
//                principal,
//                fee,
//                expiration: new anchor.BN(now + 3_600),
//            };
//            const setupIx = await program.methods
//                .openLongPositionSetup(
//                    args.nonce,
//                    args.minTargetAmount,
//                    args.downPayment,
//                    args.principal,
//                    args.fee,
//                    args.expiration,
//                )
//                .accounts({
//                    owner: user2.publicKey,
//                    lpVault: lpVaultTokenAKey,
//                    pool: longPoolBKey,
//                    collateral: tokenMintB,
//                    currency: tokenMintA,
//                    permission: coSignerPermission,
//                    //@ts-ignore
//                    authority: SWAP_AUTHORITY.publicKey,
//                    feeWallet,
//                    tokenProgram: TOKEN_PROGRAM_ID,
//                    systemProgram: SYSTEM_PROGRAM_ID,
//                })
//                .instruction();
//            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                [abSwapKey.publicKey.toBuffer()],
//                TOKEN_SWAP_PROGRAM_ID
//            );
//            const swapIx = TokenSwap.swapInstruction(
//                abSwapKey.publicKey,
//                swapAuthority,
//                SWAP_AUTHORITY.publicKey,
//                longPoolBCurrencyVaultKey,
//                swapTokenAccountA,
//                swapTokenAccountB,
//                longPoolBVaultKey,
//                poolMint,
//                poolFeeAccount,
//                null,
//                tokenMintA,
//                tokenMintB,
//                TOKEN_SWAP_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                BigInt(swapAmount.toString()),
//                BigInt(minimumAmountOut.toString())
//            );
//            const _tx = await program.methods
//                .openLongPositionCleanup()
//                .accounts({
//                    owner: user2.publicKey,
//                    pool: longPoolBKey,
//                    position: longPositionKey,
//                    tokenProgram: TOKEN_PROGRAM_ID,
//                })
//                .preInstructions([setupIx, swapIx])
//                .transaction();
//
//            const connection = program.provider.connection;
//            const lookupAccount = await connection
//                .getAddressLookupTable(openPosLut)
//                .catch(() => null);
//            const message = new anchor.web3.TransactionMessage({
//                instructions: _tx.instructions,
//                payerKey: program.provider.publicKey!,
//                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
//            }).compileToV0Message([lookupAccount.value]);
//
//            const tx = new anchor.web3.VersionedTransaction(message);
//            await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY, user2], {
//                skipPreflight: false,
//            });
//
//            const makerAmount = new anchor.BN(100);
//            const takerAmount = new anchor.BN(200);
//            await program.methods
//                .initOrUpdateTakeProfitOrder(
//                    makerAmount,
//                    takerAmount,
//                )
//                .accounts({
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    position: longPositionKey,
//                })
//                .signers([user2])
//                .rpc();
//            const takeProfitOrder = await program.account.takeProfitOrder.fetch(
//                longTakeProfitOrderKey
//            );
//            assert.equal(
//                takeProfitOrder.makerAmount.toString(),
//                makerAmount.toString()
//            );
//            assert.equal(
//                takeProfitOrder.takerAmount.toString(),
//                takerAmount.toString()
//            );
//            assert.equal(
//                takeProfitOrder.position.toString(),
//                longPositionKey.toString()
//            );
//        })
//        it("Should fill TP and cancel the SL", async () => {
//            const makerAmount = new anchor.BN(100);
//            const takerAmount = new anchor.BN(200);
//            const closeRequestExpiration = new anchor.BN(
//                Date.now() / 1_000 + 60 * 60
//            );
//            const positionBefore = await program.account.position.fetch(
//                longPositionKey
//            );
//            const vaultKey = getAssociatedTokenAddressSync(
//                positionBefore.currency,
//                lpVaultTokenAKey,
//                true
//            );
//            const [vaultBefore, ownerABefore, feeBalanceBefore] =
//                await getMultipleTokenAccounts(program.provider.connection, [
//                    vaultKey,
//                    ownerTokenA,
//                    feeWallet,
//                ], TOKEN_PROGRAM_ID);
//
//            await program.methods
//                .initOrUpdateTakeProfitOrder(
//                    makerAmount,
//                    takerAmount,
//                )
//                .accounts({
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    position: longPositionKey,
//                })
//                .signers([user2])
//                .rpc({ skipPreflight: true });
//
//            await program.methods
//                .initOrUpdateStopLossOrder(
//                    new anchor.BN(100),
//                    new anchor.BN(2_000),
//                ).accounts({
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    position: longPositionKey,
//                })
//                .signers([user2])
//                .rpc({ skipPreflight: true });
//
//            const [stopLossOrderKey] = anchor.web3.PublicKey.findProgramAddressSync(
//                [
//                    anchor.utils.bytes.utf8.encode("stop_loss_order"),
//                    longPositionKey.toBuffer(),
//                ],
//                program.programId,
//            );
//
//            const stopLossBefore = program.account.stopLossOrder.fetchNullable(stopLossOrderKey)
//
//            assert.isNotNull(stopLossBefore);
//
//            const closeSlIx = await program.methods
//                .closeStopLossOrder()
//                .accounts({
//                    closer: SWAP_AUTHORITY.publicKey,
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    permission: coSignerPermission,
//                    position: longPositionKey,
//                }).instruction();
//
//            const args = {
//                minTargetAmount: new anchor.BN(0),
//                interest: new anchor.BN(10),
//                executionFee: new anchor.BN(11),
//                expiration: closeRequestExpiration,
//            };
//            const setupIx = await program.methods
//                .takeProfitSetup(
//                    args.minTargetAmount,
//                    args.interest,
//                    args.executionFee,
//                    args.expiration,
//                )
//                .accounts({
//                    closePositionSetup: {
//                        pool: longPoolBKey,
//                        owner: user2.publicKey,
//                        collateral: tokenMintB,
//                        position: longPositionKey,
//                        permission: coSignerPermission,
//                        // @ts-ignore
//                        authority: SWAP_AUTHORITY.publicKey,
//                        tokenProgram: TOKEN_PROGRAM_ID,
//                    },
//                })
//                .instruction();
//            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                [abSwapKey.publicKey.toBuffer()],
//                TOKEN_SWAP_PROGRAM_ID
//            );
//            const swapIx = TokenSwap.swapInstruction(
//                abSwapKey.publicKey,
//                swapAuthority,
//                SWAP_AUTHORITY.publicKey,
//                longPoolBVaultKey,
//                swapTokenAccountB,
//                swapTokenAccountA,
//                longPoolBCurrencyVaultKey,
//                poolMint,
//                poolFeeAccount,
//                null,
//                tokenMintB,
//                tokenMintA,
//                TOKEN_SWAP_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                BigInt(positionBefore.collateralAmount.toString()),
//                BigInt(0)
//            );
//            const _tx = await program.methods
//                .takeProfitCleanup()
//                .accountsPartial({
//                    closePositionCleanup: {
//                        owner: user2.publicKey,
//                        ownerPayoutAccount: ownerTokenA,
//                        pool: longPoolBKey,
//                        position: longPositionKey,
//                        currency: tokenMintA,
//                        collateral: tokenMintB,
//                        authority: SWAP_AUTHORITY.publicKey,
//                        feeWallet,
//                        liquidationWallet,
//                        currencyTokenProgram: TOKEN_PROGRAM_ID,
//                        collateralTokenProgram: TOKEN_PROGRAM_ID,
//                    },
//                    takeProfitOrder: longTakeProfitOrderKey,
//                })
//                .preInstructions([closeSlIx, setupIx, swapIx])
//                .transaction();
//
//            try {
//                const connection = program.provider.connection;
//                const lookupAccount = await connection
//                    .getAddressLookupTable(openPosLut)
//                    .catch(() => null);
//                const message = new anchor.web3.TransactionMessage({
//                    instructions: _tx.instructions,
//                    payerKey: program.provider.publicKey!,
//                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
//                }).compileToV0Message([lookupAccount.value]);
//
//                const tx = new anchor.web3.VersionedTransaction(message);
//                await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
//                    skipPreflight: true,
//                });
//            } catch (e: any) {
//                console.log(e);
//            }
//
//            const [
//                takerProfitOrderAfter,
//                stopLossOrderAfter,
//                positionAfter,
//                [vaultAfter, ownerAAfter, feeBalanceAfter],
//            ] = await Promise.all([
//                program.account.takeProfitOrder.fetchNullable(longTakeProfitOrderKey),
//                program.account.stopLossOrder.fetchNullable(stopLossOrderKey),
//                program.account.position.fetchNullable(longPositionKey),
//                getMultipleTokenAccounts(program.provider.connection, [
//                    vaultKey,
//                    ownerTokenA,
//                    feeWallet,
//                ], TOKEN_PROGRAM_ID),
//            ]);
//            // Position should be cleaned up
//            assert.isNull(positionAfter);
//
//            // TP order should be closed
//            assert.isNull(takerProfitOrderAfter);
//
//            // SL order should be closed
//            assert.isNull(stopLossOrderAfter);
//
//            // should pay back some interest/principal
//            const vaultDiff = vaultAfter.amount - vaultBefore.amount;
//            assert.ok(vaultDiff > 0);
//
//            // Owner should have received payout
//            const ownerADiff = ownerAAfter.amount - ownerABefore.amount;
//            assert.ok(ownerADiff > 0);
//
//            // Fees should have been paid
//            const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
//            assert.ok(feeBalanceDiff > 0);
//        });
//    });
//    describe("Short /w SL", () => {
//        before(async () => {
//            const fee = new anchor.BN(10);
//            const now = new Date().getTime() / 1_000;
//            const downPayment = new anchor.BN(1_000);
//            // amount to be borrowed
//            const principal = new anchor.BN(1_000);
//            const swapAmount = principal;
//            const minTargetAmount = new anchor.BN(1);
//            const args = {
//                nonce,
//                minTargetAmount,
//                downPayment,
//                principal,
//                fee,
//                expiration: new anchor.BN(now + 3_600),
//            };
//            const setupIx = await program.methods
//                .openShortPositionSetup(
//                    args.nonce,
//                    args.minTargetAmount,
//                    args.downPayment,
//                    args.principal,
//                    args.fee,
//                    args.expiration,
//                )
//                .accounts({
//                    owner: user2.publicKey,
//                    lpVault: lpVaultTokenBKey,
//                    pool: shortPoolAKey,
//                    currency: tokenMintB,
//                    collateral: tokenMintA,
//                    permission: coSignerPermission,
//                    //@ts-ignore
//                    authority: SWAP_AUTHORITY.publicKey,
//                    feeWallet,
//                    currencyTokenProgram: TOKEN_PROGRAM_ID,
//                    collateralTokenProgram: TOKEN_PROGRAM_ID,
//                })
//                .instruction();
//            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                [abSwapKey.publicKey.toBuffer()],
//                TOKEN_SWAP_PROGRAM_ID
//            );
//            const swapIx = TokenSwap.swapInstruction(
//                abSwapKey.publicKey,
//                swapAuthority,
//                SWAP_AUTHORITY.publicKey,
//                shortPoolACurrencyVaultKey,
//                swapTokenAccountB,
//                swapTokenAccountA,
//                shortPoolAVaultKey,
//                poolMint,
//                poolFeeAccount,
//                null,
//                tokenMintB,
//                tokenMintA,
//                TOKEN_SWAP_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                BigInt(swapAmount.toString()),
//                BigInt(minTargetAmount.toString())
//            );
//            const _tx = await program.methods
//                .openShortPositionCleanup()
//                .accounts({
//                    owner: user2.publicKey,
//                    pool: shortPoolAKey,
//                    position: shortPositionKey,
//                    //@ts-ignore
//                    lpVault: lpVaultTokenBKey,
//                    collateral: tokenMintA,
//                    currency: tokenMintB,
//                    tokenProgram: TOKEN_PROGRAM_ID,
//                })
//                .preInstructions([setupIx, swapIx])
//                .transaction();
//
//            const connection = program.provider.connection;
//            const lookupAccount = await connection
//                .getAddressLookupTable(openPosLut)
//                .catch(() => null);
//            const message = new anchor.web3.TransactionMessage({
//                instructions: _tx.instructions,
//                payerKey: program.provider.publicKey!,
//                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
//            }).compileToV0Message([lookupAccount.value]);
//
//            const tx = new anchor.web3.VersionedTransaction(message);
//            await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY, user2], {
//                skipPreflight: true,
//            });
//        });
//
//        it("Should fill TP and cancel SL", async () => {
//            const makerAmount = new anchor.BN(2_000);
//            const takerAmount = new anchor.BN(1_000);
//            const closeRequestExpiration = new anchor.BN(
//                Date.now() / 1_000 + 60 * 60
//            );
//            const positionBefore = await program.account.position.fetch(
//                shortPositionKey
//            );
//            const vaultKey = getAssociatedTokenAddressSync(
//                positionBefore.currency,
//                lpVaultTokenBKey,
//                true
//            );
//            const [vaultBefore, ownerABefore, feeBalanceBefore] =
//                await getMultipleTokenAccounts(program.provider.connection, [
//                    vaultKey,
//                    ownerTokenA,
//                    feeWallet,
//                ], TOKEN_PROGRAM_ID);
//
//            await program.methods
//                .initOrUpdateTakeProfitOrder(
//                    makerAmount,
//                    takerAmount,
//                )
//                .accounts({
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    position: shortPositionKey,
//                })
//                .signers([user2])
//                .rpc({ skipPreflight: true });
//
//            await program.methods
//                .initOrUpdateStopLossOrder(
//                    new anchor.BN(100),
//                    new anchor.BN(2_000),
//                ).accounts({
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    position: shortPositionKey,
//                })
//                .signers([user2])
//                .rpc({ skipPreflight: true });
//
//            const [stopLossOrderKey] = anchor.web3.PublicKey.findProgramAddressSync(
//                [
//                    anchor.utils.bytes.utf8.encode("stop_loss_order"),
//                    longPositionKey.toBuffer(),
//                ],
//                program.programId,
//            );
//
//            const stopLossBefore = program.account.stopLossOrder.fetchNullable(stopLossOrderKey)
//
//            assert.isNotNull(stopLossBefore);
//
//            const closeSlIx = await program.methods
//                .closeStopLossOrder()
//                .accounts({
//                    closer: SWAP_AUTHORITY.publicKey,
//                    //@ts-ignore
//                    trader: user2.publicKey,
//                    permission: coSignerPermission,
//                    position: shortPositionKey,
//                }).instruction();
//
//            const args = {
//                minTargetAmount: new anchor.BN(0),
//                interest: new anchor.BN(10),
//                executionFee: new anchor.BN(11),
//                expiration: closeRequestExpiration,
//            };
//            const setupIx = await program.methods
//                .takeProfitSetup(
//                    args.minTargetAmount,
//                    args.interest,
//                    args.executionFee,
//                    args.expiration,
//                )
//                .accounts({
//                    closePositionSetup: {
//                        pool: shortPoolAKey,
//                        owner: user2.publicKey,
//                        collateral: tokenMintA,
//                        position: shortPositionKey,
//                        permission: coSignerPermission,
//                        // @ts-ignore
//                        authority: SWAP_AUTHORITY.publicKey,
//                        tokenProgram: TOKEN_PROGRAM_ID,
//                    },
//                })
//                .instruction();
//            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                [abSwapKey.publicKey.toBuffer()],
//                TOKEN_SWAP_PROGRAM_ID
//            );
//            const swapIx = TokenSwap.swapInstruction(
//                abSwapKey.publicKey,
//                swapAuthority,
//                SWAP_AUTHORITY.publicKey,
//                shortPoolAVaultKey,
//                swapTokenAccountA,
//                swapTokenAccountB,
//                shortPoolACurrencyVaultKey,
//                poolMint,
//                poolFeeAccount,
//                null,
//                tokenMintA,
//                tokenMintB,
//                TOKEN_SWAP_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                BigInt(positionBefore.principal.add(new anchor.BN(12)).toString()),
//                BigInt(0)
//            );
//            const _tx = await program.methods
//                .takeProfitCleanup()
//                .accounts({
//                    closePositionCleanup: {
//                        //@ts-ignore
//                        owner: user2.publicKey,
//                        ownerPayoutAccount: ownerTokenA,
//                        pool: shortPoolAKey,
//                        position: shortPositionKey,
//                        currency: tokenMintB,
//                        collateral: tokenMintA,
//                        authority: SWAP_AUTHORITY.publicKey,
//                        //@ts-ignore
//                        feeWallet,
//                        liquidationWallet,
//                        currencyTokenProgram: TOKEN_PROGRAM_ID,
//                        collateralTokenProgram: TOKEN_PROGRAM_ID,
//                    },
//                    //@ts-ignore
//                    takeProfitOrder: shortTakeProfitOrderKey,
//                })
//                .preInstructions([closeSlIx, setupIx, swapIx])
//                .transaction();
//            try {
//                const connection = program.provider.connection;
//                const lookupAccount = await connection
//                    .getAddressLookupTable(openPosLut)
//                    .catch(() => null);
//                const message = new anchor.web3.TransactionMessage({
//                    instructions: _tx.instructions,
//                    payerKey: program.provider.publicKey!,
//                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
//                }).compileToV0Message([lookupAccount.value]);
//
//                const tx = new anchor.web3.VersionedTransaction(message);
//                await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
//                    skipPreflight: true,
//                });
//            } catch (e: any) {
//                console.log(e);
//            }
//
//            const [
//                takerProfitOrderAfter,
//                stopLossOrderAfter,
//                positionAfter,
//                [vaultAfter, ownerAAfter, feeBalanceAfter],
//            ] = await Promise.all([
//                program.account.takeProfitOrder.fetchNullable(shortTakeProfitOrderKey),
//                program.account.stopLossOrder.fetchNullable(stopLossOrderKey),
//                program.account.position.fetchNullable(shortPositionKey),
//                getMultipleTokenAccounts(program.provider.connection, [
//                    vaultKey,
//                    ownerTokenA,
//                    feeWallet,
//                ], TOKEN_PROGRAM_ID),
//            ]);
//
//            // Position should be cleaned up
//            assert.isNull(positionAfter);
//
//            // TP order should be closed
//            assert.isNull(takerProfitOrderAfter);
//
//            // SL order should be closed
//            assert.isNull(stopLossOrderAfter);
//
//            // should pay back some interest/principal
//            const vaultDiff = vaultAfter.amount - vaultBefore.amount;
//            assert.ok(vaultDiff > 0);
//
//            // Owner should have received payout
//            const ownerADiff = ownerAAfter.amount - ownerABefore.amount;
//            assert.ok(ownerADiff > 0);
//
//            // Fees should have been paid
//            const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
//            assert.ok(feeBalanceDiff > 0);
//
//        });
//    });
//});
