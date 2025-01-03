import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
    abSwapKey,
    NON_SWAP_AUTHORITY,
    CAN_SWAP_CANT_LIQ_AUTH,
    openPosLut,
    poolFeeAccount,
    poolMint,
    SWAP_AUTHORITY,
    swapTokenAccountA,
    swapTokenAccountB,
    tokenMintA,
    tokenMintB,
    user2,
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

    const feeWallet = getAssociatedTokenAddressSync(tokenMintA, feeWalletKeypair.publicKey, true, TOKEN_PROGRAM_ID);

    const liquidationWallet = getAssociatedTokenAddressSync(tokenMintA, liquidationWalletKeypair.publicKey, true, TOKEN_PROGRAM_ID);

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

    const [noLiqPerm] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("admin"), CAN_SWAP_CANT_LIQ_AUTH.publicKey.toBuffer()],
        program.programId,
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
                    args.expiration,
                )
                .accounts({
                    owner: user2.publicKey,
                    lpVault: lpVaultTokenAKey,
                    pool: longPoolBKey,
                    collateral: tokenMintB,
                    currency: tokenMintA,
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

        it("should fail without liquidate permissions", async () => {
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
                .liquidatePositionSetup(
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
                        authority: CAN_SWAP_CANT_LIQ_AUTH.publicKey,
                        permission: noLiqPerm,
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
                CAN_SWAP_CANT_LIQ_AUTH.publicKey,
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
                            //@ts-ignore
                            owner: user2.publicKey,
                            ownerPayoutAccount: ownerTokenA,
                            pool: longPoolBKey,
                            collateral: tokenMintB,
                            currency: tokenMintA,
                            position: longPositionKey,
                            authority: CAN_SWAP_CANT_LIQ_AUTH.publicKey,
                            //@ts-ignore
                            lpVault: lpVaultTokenAKey,
                            feeWallet,
                            liquidationWallet,
                            collateralTokenProgram: TOKEN_PROGRAM_ID,
                            currencyTokenProgram: TOKEN_PROGRAM_ID,
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
                await program.provider.sendAndConfirm(tx, [CAN_SWAP_CANT_LIQ_AUTH], {
                    skipPreflight: true,
                });
            } catch (e) {
                console.log(e);
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

        it("should fail if liquidation threshold has not been exceeded", async () => {
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
                .liquidatePositionSetup(
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
                        collateral: tokenMintB,
                        //@ts-ignore
                        authority: NON_SWAP_AUTHORITY.publicKey,
                        permission: liquidateSignerPermission,
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
            const _tx = await program.methods
                .liquidatePositionCleanup()
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
                await program.provider.sendAndConfirm(tx, [NON_SWAP_AUTHORITY], {
                    skipPreflight: true,
                });
                assert.ok(false);
            } catch (e: any) {
                const err = anchor.translateError(
                    e,
                    anchor.parseIdlErrors(program.idl)
                );
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6026);
                } else if (err instanceof anchor.ProgramError) {
                    assert.equal(err.code, 6026);
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
            const [vaultBefore, ownerABefore, feeBalanceBefore, liquidationBalanceBefore] =
                await getMultipleTokenAccounts(program.provider.connection, [
                    vaultKey,
                    ownerTokenA,
                    feeWallet,
                    liquidationWallet,
                ], TOKEN_PROGRAM_ID);

            const args = {
                minTargetAmount: new anchor.BN(0),
                interest: new anchor.BN(10),
                executionFee: new anchor.BN(11),
                expiration: closeRequestExpiration,
            };

            const setupIx = await program.methods
                .liquidatePositionSetup(
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
                        collateral: tokenMintB,
                        //@ts-ignore
                        authority: NON_SWAP_AUTHORITY.publicKey,
                        permission: liquidateSignerPermission,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    },
                })
                .instruction();

            // Use a much larger multiplier to ensure liquidation threshold is met
            const swapAmount = positionBefore.collateralAmount.muln(5);

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
                BigInt(swapAmount.toString()),
                BigInt(0)
            );

            const _tx = await program.methods
                .liquidatePositionCleanup()
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
                await program.provider.sendAndConfirm(tx, [NON_SWAP_AUTHORITY], {
                    skipPreflight: true,
                });
            } catch (e: any) {
                console.log(e);
            }

            const [
                positionAfter,
                [vaultAfter, ownerAAfter, feeBalanceAfter],
            ] = await Promise.all([
                program.account.position.fetchNullable(longPositionKey),
                getMultipleTokenAccounts(program.provider.connection, [
                    vaultKey,
                    ownerTokenA,
                    feeWallet,
                ], TOKEN_PROGRAM_ID),
            ]);
            console.log(positionAfter);

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
                    lpVault: lpVaultTokenBKey,
                    pool: shortPoolAKey,
                    currency: tokenMintB,
                    collateral: tokenMintA,
                    //@ts-ignore
                    authority: SWAP_AUTHORITY.publicKey,
                    permission: coSignerPermission,
                    feeWallet,
                    currencyTokenProgram: TOKEN_PROGRAM_ID,
                    collateralTokenProgram: TOKEN_PROGRAM_ID,
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
                    currency: tokenMintB,
                    collateral: tokenMintA,
                    //@ts-ignore
                    lpVault: lpVaultTokenBKey,
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

        it("should fail if liquidation threshold has not been exceeded", async () => {
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

            const args = {
                minTargetAmount: new anchor.BN(0),
                interest: new anchor.BN(10),
                executionFee: new anchor.BN(11),
                expiration: closeRequestExpiration,
            };
            const setupIx = await program.methods
                .liquidatePositionSetup(
                    args.minTargetAmount,
                    args.interest,
                    args.executionFee,
                    args.expiration,
                )
                .accounts({
                    closePositionSetup: {
                        owner: user2.publicKey,
                        position: shortPositionKey,
                        pool: shortPoolAKey,
                        collateral: tokenMintA,
                        // @ts-ignore
                        authority: NON_SWAP_AUTHORITY.publicKey,
                        permission: liquidateSignerPermission,
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
                BigInt(positionBefore.principal.mul(new anchor.BN(3)).toString()),
                BigInt(0)
            );
            const _tx = await program.methods
                .liquidatePositionCleanup()
                .accounts({
                    closePositionCleanup: {
                        //@ts-ignore
                        owner: user2.publicKey,
                        ownerPayoutAccount: ownerTokenA,
                        pool: shortPoolAKey,
                        collateral: tokenMintA,
                        currency: tokenMintB,
                        position: shortPositionKey,
                        authority: NON_SWAP_AUTHORITY.publicKey,
                        //@ts-ignore
                        lpVault: lpVaultTokenBKey,
                        feeWallet,
                        liquidationWallet,
                        currencyTokenProgram: TOKEN_PROGRAM_ID,
                        collateralTokenProgram: TOKEN_PROGRAM_ID,
                    },
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
                await program.provider.sendAndConfirm(tx, [NON_SWAP_AUTHORITY], {
                    skipPreflight: true,
                });

                assert.fail("Expected transaction to fail with LiquidationThresholdNotReached error");
            } catch (e: any) {
                console.log(e);
                const err = anchor.translateError(
                    e,
                    anchor.parseIdlErrors(program.idl)
                );
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6026);
                } else if (err instanceof anchor.ProgramError) {
                    assert.equal(err.code, 6026);
                } else {
                    assert.ok(false);
                }
            }

            // Verify position still exists and wasn't liquidated
            const positionAfter = await program.account.position.fetch(shortPositionKey);
            assert.ok(positionAfter, "Position should still exist");
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
                    feeWallet,
                ], TOKEN_PROGRAM_ID);

            const args = {
                minTargetAmount: new anchor.BN(0),
                interest: new anchor.BN(10),
                executionFee: new anchor.BN(11),
                expiration: closeRequestExpiration,
            };
            const setupIx = await program.methods
                .liquidatePositionSetup(
                    args.minTargetAmount,
                    args.interest,
                    args.executionFee,
                    args.expiration,
                )
                .accounts({
                    closePositionSetup: {
                        owner: user2.publicKey,
                        position: shortPositionKey,
                        pool: shortPoolAKey,
                        collateral: tokenMintA,
                        // @ts-ignore
                        authority: NON_SWAP_AUTHORITY.publicKey,
                        permission: liquidateSignerPermission,
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
                BigInt(positionBefore.principal.mul(new anchor.BN(3)).toString()),
                BigInt(0)
            );
            const _tx = await program.methods
                .liquidatePositionCleanup()
                .accounts({
                    closePositionCleanup: {
                        //@ts-ignore
                        owner: user2.publicKey,
                        ownerPayoutAccount: ownerTokenA,
                        pool: shortPoolAKey,
                        collateral: tokenMintA,
                        currency: tokenMintB,
                        position: shortPositionKey,
                        authority: NON_SWAP_AUTHORITY.publicKey,
                        //@ts-ignore
                        lpVault: lpVaultTokenBKey,
                        feeWallet,
                        liquidationWallet,
                        currencyTokenProgram: TOKEN_PROGRAM_ID,
                        collateralTokenProgram: TOKEN_PROGRAM_ID,
                    },
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
                await program.provider.sendAndConfirm(tx, [NON_SWAP_AUTHORITY], {
                    skipPreflight: true,
                });
            } catch (e: any) {
                console.log(e);
            }

            const [
                positionAfter,
                [vaultAfter, ownerAAfter, feeBalanceAfter],
            ] = await Promise.all([
                program.account.position.fetchNullable(shortPositionKey),
                getMultipleTokenAccounts(program.provider.connection, [
                    vaultKey,
                    ownerTokenA,
                    feeWallet,
                ], TOKEN_PROGRAM_ID),
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
