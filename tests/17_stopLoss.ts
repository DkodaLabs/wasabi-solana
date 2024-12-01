import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
    abSwapKey,
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
    superAdminProgram,
    feeWalletKeypair,
    liquidationWalletKeypair,
} from "./rootHooks";
import {
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TOKEN_SWAP_PROGRAM_ID, TokenSwap } from "@solana/spl-token-swap";
import { assert } from "chai";
import { getMultipleTokenAccounts } from "./utils";

describe("stopLoss", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

    const feeWallet = getAssociatedTokenAddressSync(tokenMintA, feeWalletKeypair.publicKey, true, TOKEN_PROGRAM_ID)

    const liquidationWallet = getAssociatedTokenAddressSync(tokenMintA, liquidationWalletKeypair.publicKey, true, TOKEN_PROGRAM_ID);

    const [coSignerPermission] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("admin"),
            SWAP_AUTHORITY.publicKey.toBuffer(),
        ],
        program.programId
    );
    const [nonSwapAuthSignerPermission] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("admin"),
                NON_SWAP_AUTHORITY.publicKey.toBuffer(),
            ],
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
    const nonce = 17;
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
    const [longStopLossOrderKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("stop_loss_order"),
            longPositionKey.toBuffer(),
        ],
        program.programId
    );
    const [shortStopLossOrderKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("stop_loss_order"),
            shortPositionKey.toBuffer(),
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

            const args = {
                nonce,
                minTargetAmount: minimumAmountOut,
                downPayment,
                principal,
                fee,
                expiration: new anchor.BN(now + 3_600),
            };
            const setupIx = await program.methods
                .openLongPositionSetup(
                    args.nonce,
                    args.minTargetAmount,
                    args.downPayment,
                    args.principal,
                    args.fee,
                    args.expiration
                )
                .accounts({
                    owner: user2.publicKey,
                    lpVault: lpVaultTokenAKey,
                    pool: longPoolBKey,
                    currency: tokenMintA,
                    collateral: tokenMintB,
                    //@ts-ignore
                    authority: SWAP_AUTHORITY.publicKey,
                    permission: coSignerPermission,
                    feeWallet,
                    tokenProgram: TOKEN_PROGRAM_ID,
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
                    pool: longPoolBKey,
                    position: longPositionKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
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

        it("should init SL order", async () => {
            const makerAmount = new anchor.BN(100);
            const takerAmount = new anchor.BN(200);
            await program.methods
                .initOrUpdateStopLossOrder(
                    makerAmount,
                    takerAmount,
                )
                .accounts({
                    //@ts-ignore
                    trader: user2.publicKey,
                    position: longPositionKey,
                })
                .signers([user2])
                .rpc();
            const stopLossOrder = await program.account.stopLossOrder.fetch(
                longStopLossOrderKey
            );
            assert.equal(
                stopLossOrder.makerAmount.toString(),
                makerAmount.toString()
            );
            assert.equal(
                stopLossOrder.takerAmount.toString(),
                takerAmount.toString()
            );
            assert.equal(
                stopLossOrder.position.toString(),
                longPositionKey.toString()
            );
        });

        it("should fail to close SL order without proper permissions", async () => {
            const [adminKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), NON_SWAP_AUTHORITY.publicKey.toBuffer()],
                superAdminProgram.programId,
            );
            try {
                await program.methods
                    .closeStopLossOrder()
                    .accounts({
                        closer: SWAP_AUTHORITY.publicKey,
                        //@ts-ignore
                        trader: user2.publicKey,
                        permission: adminKey,
                        position: longPositionKey,
                    })
                    .signers([SWAP_AUTHORITY])
                    .rpc();
                throw new Error("Should fail");
            } catch (e: any) {
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

        it("should close SL order with user", async () => {
            const [adminKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), NON_SWAP_AUTHORITY.publicKey.toBuffer()],
                superAdminProgram.programId,
            );
            await program.methods
                .closeStopLossOrder()
                .accounts({
                    closer: user2.publicKey,
                    //@ts-ignore
                    trader: user2.publicKey,
                    permission: adminKey,
                    position: longPositionKey,
                })
                .signers([user2])
                .rpc();
            const stopLossOrder = await program.account.stopLossOrder.fetchNullable(
                longStopLossOrderKey
            );
            assert.isNull(stopLossOrder);
        });

        it("should close SL order with admin", async () => {
            const makerAmount = new anchor.BN(100);
            const takerAmount = new anchor.BN(200);
            await program.methods
                .initOrUpdateStopLossOrder(
                    makerAmount,
                    takerAmount,
                )
                .accounts({
                    //@ts-ignore
                    trader: user2.publicKey,
                    position: longPositionKey,
                })
                .signers([user2])
                .rpc();

            const [adminKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), NON_SWAP_AUTHORITY.publicKey.toBuffer()],
                superAdminProgram.programId,
            );
            await program.methods
                .closeStopLossOrder()
                .accounts({
                    closer: NON_SWAP_AUTHORITY.publicKey,
                    //@ts-ignore
                    trader: user2.publicKey,
                    permission: adminKey,
                    position: longPositionKey,
                })
                .signers([NON_SWAP_AUTHORITY])
                .rpc();
            const stopLossOrder = await program.account.stopLossOrder.fetchNullable(
                longStopLossOrderKey
            );
            assert.isNull(stopLossOrder);
        });

        it("Should fail when authority cannot co-sign swaps", async () => {
            const closeRequestExpiration = new anchor.BN(
                Date.now() / 1_000 + 60 * 60
            );
            const positionBefore = await program.account.position.fetch(
                longPositionKey
            );

            const args = {
                minTargetAmount: new anchor.BN(0),
                interest: new anchor.BN(10),
                executionFee: new anchor.BN(11),
                expiration: closeRequestExpiration,
            };
            const setupIx = await program.methods
                .stopLossSetup(
                    args.minTargetAmount,
                    args.interest,
                    args.executionFee,
                    args.expiration,
                )
                .accounts({
                    closePositionSetup: {
                        owner: user2.publicKey,
                        position: longPositionKey,
                        pool: longPoolBKey,
                        collateral: tokenMintB,
                        // @ts-ignore
                        authority: NON_SWAP_AUTHORITY.publicKey,
                        permission: nonSwapAuthSignerPermission,
                        tokenProgram: TOKEN_PROGRAM_ID,
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
                const _tx = await program.methods
                    .stopLossCleanup()
                    .accounts({
                        closePositionCleanup: {
                            //@ts-ignore
                            owner: user2.publicKey,
                            ownerPayoutAccount: ownerTokenA,
                            position: longPositionKey,
                            pool: longPoolBKey,
                            currency: tokenMintA,
                            collateral: tokenMintB,
                            authority: NON_SWAP_AUTHORITY.publicKey,
                            //@ts-ignore
                            lpVault: lpVaultTokenAKey,
                            feeWallet,
                            liquidationWallet,
                            currencyTokenProgram: TOKEN_PROGRAM_ID,
                            collateralTokenProgram: TOKEN_PROGRAM_ID,
                        },
                        stopLossOrder: longStopLossOrderKey,
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
                throw new Error("Should have failed");
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

        it("Should fail when the SL taker amount is exceeded", async () => {
            const makerAmount = new anchor.BN(200);
            const takerAmount = new anchor.BN(100);
            const closeRequestExpiration = new anchor.BN(
                Date.now() / 1_000 + 60 * 60
            );
            const positionBefore = await program.account.position.fetch(
                longPositionKey
            );

            await program.methods
                .initOrUpdateStopLossOrder(
                    makerAmount,
                    takerAmount,
                )
                .accounts({
                    //@ts-ignore
                    trader: user2.publicKey,
                    position: longPositionKey,
                })
                .signers([user2])
                .rpc({ skipPreflight: true });
            const args = {
                minTargetAmount: new anchor.BN(0),
                interest: new anchor.BN(10),
                executionFee: new anchor.BN(11),
                expiration: closeRequestExpiration,
            };
            const setupIx = await program.methods
                .stopLossSetup(
                    args.minTargetAmount,
                    args.interest,
                    args.executionFee,
                    args.expiration
                )
                .accounts({
                    closePositionSetup: {
                        owner: user2.publicKey,
                        position: longPositionKey,
                        pool: longPoolBKey,
                        collateral: tokenMintA,
                        // @ts-ignore
                        authority: SWAP_AUTHORITY.publicKey,
                        permission: coSignerPermission,
                        tokenProgram: TOKEN_PROGRAM_ID,
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
                    .stopLossCleanup()
                    .accounts({
                        closePositionCleanup: {
                            //@ts-ignore
                            owner: user2.publicKey,
                            ownerPayoutAccount: ownerTokenA,
                            pool: longPoolBKey,
                            position: longPositionKey,
                            currency: tokenMintA,
                            collateral: tokenMintB,
                            authority: SWAP_AUTHORITY.publicKey,
                            //@ts-ignore
                            feeWallet,
                            liquidationWallet,
                            currencyTokenProgram: TOKEN_PROGRAM_ID,
                            collateralTokenProgram: TOKEN_PROGRAM_ID,
                        },
                        //@ts-ignore
                        stopLossOrder: longStopLossOrderKey,
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
                throw new Error("Failed to error");
            } catch (e) {
                if (e.message && e.message.includes('{"Custom":6017}')) {
                    return;
                }
                const err = anchor.translateError(
                    e,
                    anchor.parseIdlErrors(program.idl)
                );
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6017);
                } else if (err instanceof anchor.ProgramError) {
                    assert.equal(err.code, 6017);
                } else {
                    assert.ok(false);
                }
            }

            // must close the TP order so new ones can be created on the existing position
            await program.methods
                .closeStopLossOrder()
                .accounts({
                    closer: user2.publicKey,
                    //@ts-ignore
                    trader: user2.publicKey,
                    permission: coSignerPermission,
                    position: longPositionKey,
                })
                .signers([user2])
                .rpc({ skipPreflight: true });
        });

        it("should execute SL order", async () => {
            const makerAmount = new anchor.BN(100);
            const takerAmount = new anchor.BN(2_000);
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
                    feeWallet,
                ], TOKEN_PROGRAM_ID);

            await program.methods
                .initOrUpdateStopLossOrder(
                    makerAmount,
                    takerAmount,
                )
                .accounts({
                    //@ts-ignore
                    trader: user2.publicKey,
                    position: longPositionKey,
                })
                .signers([user2])
                .rpc({ skipPreflight: true });

            const args = {
                minTargetAmount: new anchor.BN(0),
                interest: new anchor.BN(10),
                executionFee: new anchor.BN(11),
                expiration: closeRequestExpiration,
            };
            const setupIx = await program.methods
                .stopLossSetup(
                    args.minTargetAmount,
                    args.interest,
                    args.executionFee,
                    args.expiration
                )
                .accounts({
                    closePositionSetup: {
                        owner: user2.publicKey,
                        pool: longPoolBKey,
                        position: longPositionKey,
                        collateral: tokenMintB,
                        // @ts-ignore
                        authority: SWAP_AUTHORITY.publicKey,
                        permission: coSignerPermission,
                        tokenProgram: TOKEN_PROGRAM_ID,
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
                .stopLossCleanup()
                .accounts({
                    closePositionCleanup: {
                        //@ts-ignore
                        owner: user2.publicKey,
                        ownerPayoutAccount: ownerTokenA,
                        pool: longPoolBKey,
                        position: longPositionKey,
                        collateral: tokenMintB,
                        currency: tokenMintA,
                        authority: SWAP_AUTHORITY.publicKey,
                        //@ts-ignore
                        feeWallet,
                        liquidationWallet,
                        currencyTokenProgram: TOKEN_PROGRAM_ID,
                        collateralTokenProgram: TOKEN_PROGRAM_ID,
                    },
                    //@ts-ignore
                    stopLossOrder: longStopLossOrderKey,
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

            const [
                stopLossOrderAfter,
                positionAfter,
                [vaultAfter, ownerAAfter, feeBalanceAfter],
            ] = await Promise.all([
                program.account.stopLossOrder.fetchNullable(longStopLossOrderKey),
                program.account.position.fetchNullable(longPositionKey),
                getMultipleTokenAccounts(program.provider.connection, [
                    vaultKey,
                    ownerTokenA,
                    feeWallet,
                ], TOKEN_PROGRAM_ID),
            ]);
            // Position should be cleaned up
            assert.isNull(positionAfter);

            // SL order should be closed
            assert.isNull(stopLossOrderAfter);

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
            const args = {
                nonce,
                minTargetAmount,
                downPayment,
                principal,
                fee,
                expiration: new anchor.BN(now + 3_600),
            };
            const setupIx = await program.methods
                .openShortPositionSetup(
                    args.nonce,
                    args.minTargetAmount,
                    args.downPayment,
                    args.principal,
                    args.fee,
                    args.expiration,
                )
                .accounts({
                    owner: user2.publicKey,
                    pool: shortPoolAKey,
                    collateral: tokenMintA,
                    currency: tokenMintB,
                    lpVault: lpVaultTokenBKey,
                    //@ts-ignore
                    authority: SWAP_AUTHORITY.publicKey,
                    permission: coSignerPermission,
                    feeWallet,
                    currencyTokenProgram: TOKEN_PROGRAM_ID,
                    collateralTokenProgram: TOKEN_PROGRAM_ID
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
                    position: shortPositionKey,
                    pool: shortPoolAKey,
                    //@ts-ignore
                    lpVault: lpVaultTokenBKey,
                    currency: tokenMintB,
                    collateral: tokenMintA,
                    tokenProgram: TOKEN_PROGRAM_ID,
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

        it("Should fail when the TP taker amount is not met", async () => {
            // very high price of 1000
            const makerAmount = new anchor.BN(1_000);
            const takerAmount = new anchor.BN(1);
            const closeRequestExpiration = new anchor.BN(
                Date.now() / 1_000 + 60 * 60
            );
            const positionBefore = await program.account.position.fetch(
                shortPositionKey
            );

            await program.methods
                .initOrUpdateStopLossOrder(
                    makerAmount,
                    takerAmount,
                )
                .accounts({
                    //@ts-ignore
                    trader: user2.publicKey,
                    position: shortPositionKey,
                })
                .signers([user2])
                .rpc({ skipPreflight: true });
            const args = {
                minTargetAmount: new anchor.BN(0),
                interest: new anchor.BN(1),
                executionFee: new anchor.BN(11),
                expiration: closeRequestExpiration,
            };
            const setupIx = await program.methods
                .stopLossSetup(
                    args.minTargetAmount,
                    args.interest,
                    args.executionFee,
                    args.expiration,
                )
                .accounts({
                    closePositionSetup: {
                        owner: user2.publicKey,
                        pool: shortPoolAKey,
                        position: shortPositionKey,
                        collateral: tokenMintA,
                        // @ts-ignore
                        authority: SWAP_AUTHORITY.publicKey,
                        permission: coSignerPermission,
                        tokenProgram: TOKEN_PROGRAM_ID,
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
            try {
                const _tx = await program.methods
                    .stopLossCleanup()
                    .accounts({
                        closePositionCleanup: {
                            //@ts-ignore
                            owner: user2.publicKey,
                            ownerPayoutAccount: ownerTokenA,
                            pool: shortPoolAKey,
                            position: shortPositionKey,
                            currency: tokenMintB,
                            collateral: tokenMintA,
                            authority: SWAP_AUTHORITY.publicKey,
                            //@ts-ignore
                            feeWallet,
                            liquidationWallet,
                            currencyTokenProgram: TOKEN_PROGRAM_ID,
                            collateralTokenProgram: TOKEN_PROGRAM_ID,
                        },
                        //@ts-ignore
                        stopLossOrder: shortStopLossOrderKey,
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
                throw new Error("Failed to error");
            } catch (e) {
                if (e.message && e.message.includes('{"Custom":6017}')) {
                    return;
                }
                const err = anchor.translateError(
                    e,
                    anchor.parseIdlErrors(program.idl)
                );
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6017);
                } else if (err instanceof anchor.ProgramError) {
                    assert.equal(err.code, 6017);
                } else {
                    assert.ok(false);
                }
            }

            // must close the TP order so new ones can be created on the existing position
            await program.methods
                .closeStopLossOrder()
                .accounts({
                    closer: user2.publicKey,
                    //@ts-ignore
                    trader: user2.publicKey,
                    permission: NON_SWAP_AUTHORITY.publicKey,
                    position: shortPositionKey,
                })
                .signers([user2])
                .rpc({ skipPreflight: true });
        });

        it("Should execute SL order", async () => {
            // price of 0.5
            const makerAmount = new anchor.BN(1_000);
            const takerAmount = new anchor.BN(2_000);
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
                    feeWallet,
                ], TOKEN_PROGRAM_ID);

            await program.methods
                .initOrUpdateStopLossOrder(
                    makerAmount,
                    takerAmount,
                )
                .accounts({
                    //@ts-ignore
                    trader: user2.publicKey,
                    position: shortPositionKey,
                })
                .signers([user2])
                .rpc({ skipPreflight: true });
            const args = {
                minTargetAmount: new anchor.BN(0),
                interest: new anchor.BN(10),
                executionFee: new anchor.BN(11),
                expiration: closeRequestExpiration,
            };
            const setupIx = await program.methods
                .stopLossSetup(
                    args.minTargetAmount,
                    args.interest,
                    args.executionFee,
                    args.expiration,
                )
                .accounts({
                    closePositionSetup: {
                        owner: user2.publicKey,
                        pool: shortPoolAKey,
                        position: shortPositionKey,
                        collateral: tokenMintA,
                        // @ts-ignore
                        authority: SWAP_AUTHORITY.publicKey,
                        permission: coSignerPermission,
                        tokenProgram: TOKEN_PROGRAM_ID,
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
                .stopLossCleanup()
                .accountsPartial({
                    closePositionCleanup: {
                        //@ts-ignore
                        owner: user2.publicKey,
                        ownerPayoutAccount: ownerTokenA,
                        pool: shortPoolAKey,
                        position: shortPositionKey,
                        currency: tokenMintB,
                        collateral: tokenMintA,
                        authority: SWAP_AUTHORITY.publicKey,
                        feeWallet,
                        liquidationWallet,
                        currencyTokenProgram: TOKEN_PROGRAM_ID,
                        collateralTokenProgram: TOKEN_PROGRAM_ID,
                    },
                    //@ts-ignore
                    stopLossOrder: shortStopLossOrderKey,
                })
                .preInstructions([setupIx, swapIx])
                .transaction();
            try {
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
            } catch (e: any) {
                console.log(e);
            }

            const [
                stopLossOrderAfter,
                positionAfter,
                [vaultAfter, ownerAAfter, feeBalanceAfter],
            ] = await Promise.all([
                program.account.stopLossOrder.fetchNullable(shortStopLossOrderKey),
                program.account.position.fetchNullable(shortPositionKey),
                getMultipleTokenAccounts(program.provider.connection, [
                    vaultKey,
                    ownerTokenA,
                    feeWallet,
                ], TOKEN_PROGRAM_ID),
            ]);

            // Position should be cleaned up
            assert.isNull(positionAfter);

            // SL order should be closed
            assert.isNull(stopLossOrderAfter);

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

    describe("Close position and close TP", () => {
        before(async () => {
            // Create Long position that will have a TP order
            const fee = new anchor.BN(10);
            const now = new Date().getTime() / 1_000;
            const downPayment = new anchor.BN(1_000);
            // amount to be borrowed
            const principal = new anchor.BN(1_000);
            const swapAmount = downPayment.add(principal);
            const minimumAmountOut = new anchor.BN(1_900);

            const args = {
                nonce,
                minTargetAmount: minimumAmountOut,
                downPayment,
                principal,
                fee,
                expiration: new anchor.BN(now + 3_600),
            };
            const setupIx = await program.methods
                .openLongPositionSetup(
                    args.nonce,
                    args.minTargetAmount,
                    args.downPayment,
                    args.principal,
                    args.fee,
                    args.expiration
                )
                .accounts({
                    owner: user2.publicKey,
                    lpVault: lpVaultTokenAKey,
                    pool: longPoolBKey,
                    currency: tokenMintA,
                    collateral: tokenMintB,
                    //@ts-ignore
                    authority: SWAP_AUTHORITY.publicKey,
                    permission: coSignerPermission,
                    feeWallet,
                    tokenProgram: TOKEN_PROGRAM_ID,
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
                    pool: longPoolBKey,
                    position: longPositionKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
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
        it("Should succesfully cancel SL", async () => {
            const makerAmount = new anchor.BN(100);
            const takerAmount = new anchor.BN(200);
            await program.methods
                .initOrUpdateStopLossOrder(
                    makerAmount,
                    takerAmount,
                )
                .accounts({
                    //@ts-ignore
                    trader: user2.publicKey,
                    position: longPositionKey,
                })
                .signers([user2])
                .rpc();
            const stopLossOrder = await program.account.stopLossOrder.fetch(
                longStopLossOrderKey
            );
            assert.equal(
                stopLossOrder.makerAmount.toString(),
                makerAmount.toString()
            );
            assert.equal(
                stopLossOrder.takerAmount.toString(),
                takerAmount.toString()
            );
            assert.equal(
                stopLossOrder.position.toString(),
                longPositionKey.toString()
            );

        });

    });

});
