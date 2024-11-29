import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    createMintToInstruction,
} from "@solana/spl-token";
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
    feeWalletKeypair,
    liquidationWalletKeypair,
} from "./rootHooks";
import { getMultipleTokenAccounts } from "./utils";
import { TOKEN_SWAP_PROGRAM_ID, TokenSwap } from "@solana/spl-token-swap";

// Shorting token B using token A as collateral
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

    const feeWallet = getAssociatedTokenAddressSync(
        tokenMintA, 
        feeWalletKeypair.publicKey, 
        true, 
        TOKEN_PROGRAM_ID
    );

    const liquidationWallet = getAssociatedTokenAddressSync(
        tokenMintA,
        liquidationWalletKeypair.publicKey,
        true,
        TOKEN_PROGRAM_ID,
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
                const args = {
                    minTargetAmount: new anchor.BN(0),
                    interest: new anchor.BN(10),
                    executionFee: new anchor.BN(10),
                    expiration: closeRequestExpiration,
                };
                const setupIx = await program.methods
                    .closeShortPositionSetup(
                        args.minTargetAmount,
                        args.interest,
                        args.executionFee,
                        args.expiration,
                    )
                    .accounts({
                        owner: user2.publicKey,
                        closePositionSetup: {
                            pool: shortPoolAKey,
                            owner: user2.publicKey,
                            position: positionKey,
                            permission: coSignerPermission,
                            //@ts-ignore
                            authority: SWAP_AUTHORITY.publicKey,
                            collateral: tokenMintA,
                            tokenProgram: TOKEN_PROGRAM_ID,
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
                    BigInt(positionBefore.collateralAmount.toString()),
                    BigInt(0)
                );
                try {
                    const _tx = await program.methods
                        .closeShortPositionCleanup()
                        .accounts({
                            owner: user2.publicKey,
                            collateral: tokenMintA,
                            collateralTokenProgram: TOKEN_PROGRAM_ID,
                            closePositionCleanup: {
                                owner: user2.publicKey,
                                pool: shortPoolAKey,
                                position: positionKey,
                                currency: tokenMintB,
                                collateral: tokenMintA,
                                authority: SWAP_AUTHORITY.publicKey,
                                //@ts-ignore
                                feeWallet,
                                liquidationWallet,
                                collateralTokenProgram: TOKEN_PROGRAM_ID,
                                currencyTokenProgram: TOKEN_PROGRAM_ID,
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

                const args = {
                    minTargetAmount: new anchor.BN(0),
                    interest: new anchor.BN(10),
                    executionFee: new anchor.BN(10),
                    expiration: closeRequestExpiration,
                };
                const setupIx = await program.methods
                    .closeShortPositionSetup(
                        args.minTargetAmount,
                        args.interest,
                        args.executionFee,
                        args.expiration,
                    )
                    .accounts({
                        owner: program.provider.publicKey,
                        closePositionSetup: {
                            pool: shortPoolAKey,
                            owner: program.provider.publicKey,
                            collateral: tokenMintA,
                            position: positionKey,
                            permission: badCoSignerPermission,
                            //@ts-ignore
                            authority: NON_SWAP_AUTHORITY.publicKey,
                            tokenProgram: TOKEN_PROGRAM_ID,
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
                    BigInt(positionBefore.collateralAmount.toString()),
                    BigInt(0)
                );
                try {
                    const _tx = await program.methods
                        .closeShortPositionCleanup()
                        .accounts({
                            owner: program.provider.publicKey,
                            collateral: tokenMintA,
                            collateralTokenProgram: TOKEN_PROGRAM_ID,
                            closePositionCleanup: {
                                owner: program.provider.publicKey,
                                pool: shortPoolAKey,
                                position: positionKey,
                                currency: tokenMintB,
                                collateral: tokenMintA,
                                authority: NON_SWAP_AUTHORITY.publicKey,
                                //@ts-ignore
                                feeWallet,
                                liquidationWallet,
                                collateralTokenProgram: TOKEN_PROGRAM_ID,
                                currencyTokenProgram: TOKEN_PROGRAM_ID,
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
                    await program.provider.sendAndConfirm(tx, [NON_SWAP_AUTHORITY], {
                        skipPreflight: false,
                    });

                    assert.ok(false);
                } catch (e: any) {
                    const err = anchor.translateError(
                        e,
                        anchor.parseIdlErrors(program.idl)
                    );
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
                    const args = {
                        minTargetAmount: new anchor.BN(0),
                        interest: new anchor.BN(10),
                        executionFee: new anchor.BN(10),
                        expiration: closeRequestExpiration,
                    };
                    const setupIx = await program.methods
                        .closeShortPositionSetup(
                            args.minTargetAmount,
                            args.interest,
                            args.executionFee,
                            args.expiration,
                        )
                        .accounts({
                            owner: program.provider.publicKey,
                            closePositionSetup: {
                                pool: shortPoolAKey,
                                owner: program.provider.publicKey,
                                collateral: tokenMintA,
                                position: positionKey,
                                permission: coSignerPermission,
                                //@ts-ignore
                                authority: SWAP_AUTHORITY.publicKey,
                                tokenProgram: TOKEN_PROGRAM_ID,
                            }
                        })
                        .instruction();
                    await program.methods
                        .closeShortPositionCleanup()
                        .accounts({
                            owner: program.provider.publicKey,
                            collateral: tokenMintA,
                            collateralTokenProgram: TOKEN_PROGRAM_ID,
                            closePositionCleanup: {
                                owner: program.provider.publicKey,
                                pool: shortPoolAKey,
                                position: positionKey,
                                currency: tokenMintB,
                                collateral: tokenMintA,
                                //@ts-ignore
                                feeWallet,
                                liquidationWallet,
                                authority: SWAP_AUTHORITY.publicKey,
                                collateralTokenProgram: TOKEN_PROGRAM_ID,
                                currencyTokenProgram: TOKEN_PROGRAM_ID,
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
                    const args = {
                        minTargetAmount: new anchor.BN(0),
                        interest: new anchor.BN(10),
                        executionFee: new anchor.BN(10),
                        expiration: closeRequestExpiration,
                    };
                    await program.methods
                        .closeShortPositionSetup(
                            args.minTargetAmount,
                            args.interest,
                            args.executionFee,
                            args.expiration,
                        )
                        .accounts({
                            closePositionSetup: {
                                pool: shortPoolAKey,
                                owner: program.provider.publicKey,
                                collateral: tokenMintA,
                                position: positionKey,
                                permission: coSignerPermission,
                                //@ts-ignore
                                authority: SWAP_AUTHORITY.publicKey,
                                tokenProgram: TOKEN_PROGRAM_ID,
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

        describe("user tries to close a short position with bad debt", () => {
            it("should fail with BadDebt error", async () => {
                // Setup instruction
                const setupIx = await program.methods
                    .closeShortPositionSetup(
                        new anchor.BN(0),
                        new anchor.BN(10), // interest
                        new anchor.BN(11), // execution fee
                        new anchor.BN(Math.floor(Date.now() / 1000) + 3600)
                    )
                    .accounts({
                        owner: program.provider.publicKey,
                        closePositionSetup: {
                            owner: program.provider.publicKey,
                            position: positionKey,
                            pool: shortPoolAKey,
                            collateral: tokenMintA,
                            //@ts-ignore
                            authority: SWAP_AUTHORITY.publicKey,
                            permission: coSignerPermission,
                            tokenProgram: TOKEN_PROGRAM_ID,
                        }
                    })
                    .instruction();

                // After setup: drain collateral and mint small amount to currency
                const drainCollateralIx = createTransferInstruction(
                    shortPoolAVaultKey, // Collateral vault (tokenMintA)
                    ownerTokenA,
                    SWAP_AUTHORITY.publicKey,
                    1800, // Leave small amount from what we got from opening
                    [SWAP_AUTHORITY],
                    TOKEN_PROGRAM_ID
                );

                // Mint small amount to currency to ensure positive delta but not enough for principal
                const mintCurrencyIx = createMintToInstruction(
                    tokenMintB, // Currency for shorts is tokenMintB
                    shortPoolACurrencyVaultKey,
                    program.provider.publicKey,
                    500, // Not enough to cover principal of 1000
                    undefined,
                    TOKEN_PROGRAM_ID
                );

                try {
                    await program.methods
                        .closeShortPositionCleanup()
                        .accounts({
                            owner: program.provider.publicKey,
                            collateral: tokenMintA,
                            collateralTokenProgram: TOKEN_PROGRAM_ID,
                            closePositionCleanup: {
                                owner: program.provider.publicKey,
                                pool: shortPoolAKey,
                                collateral: tokenMintA,
                                currency: tokenMintB,
                                position: positionKey,
                                authority: SWAP_AUTHORITY.publicKey,
                                //@ts-ignore
                                feeWallet,
                                liquidationWallet,
                                collateralTokenProgram: TOKEN_PROGRAM_ID,
                                currencyTokenProgram: TOKEN_PROGRAM_ID,
                            }
                        })
                        .preInstructions([
                            setupIx,
                            drainCollateralIx,
                            mintCurrencyIx,
                        ])
                        .signers([SWAP_AUTHORITY])
                        .rpc({ skipPreflight: true });

                    assert.fail("Expected transaction to fail with BadDebt error");
                } catch (error) {
                    assert.equal(error.code, 6011);
                    assert.equal(error.msg, "Cannot close bad debt");
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
                    [vaultKey, ownerTokenA, ownerTokenB, feeWallet],
                    TOKEN_PROGRAM_ID,
                );
                const args = {
                    minTargetAmount: new anchor.BN(0),
                    interest: interestOwed,
                    executionFee: closeExecutionFee,
                    expiration: closeRequestExpiration,
                };
                const setupIx = await program.methods
                    .closeShortPositionSetup(
                        args.minTargetAmount,
                        args.interest,
                        args.executionFee,
                        args.expiration,
                    )
                    .accounts({
                        owner: program.provider.publicKey,
                        closePositionSetup: {
                            owner: program.provider.publicKey,
                            position: positionKey,
                            pool: shortPoolAKey,
                            collateral: tokenMintA,
                            //@ts-ignore
                            authority: SWAP_AUTHORITY.publicKey,
                            permission: coSignerPermission,
                            tokenProgram: TOKEN_PROGRAM_ID,
                        }
                    })
                    .instruction();
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
                    // Manually adjusting in order to achieve an "exact out".
                    BigInt(positionBefore.principal.add(new anchor.BN(11)).toString()),
                    BigInt(0)
                );
                const _tx = await program.methods
                    .closeShortPositionCleanup()
                    .accounts({
                        owner: program.provider.publicKey,
                        collateral: tokenMintA,
                        collateralTokenProgram: TOKEN_PROGRAM_ID,
                        closePositionCleanup: {
                            owner: program.provider.publicKey,
                            pool: shortPoolAKey,
                            collateral: tokenMintA,
                            currency: tokenMintB,
                            position: positionKey,
                            authority: SWAP_AUTHORITY.publicKey,
                            //@ts-ignore
                            feeWallet,
                            liquidationWallet,
                            collateralTokenProgram: TOKEN_PROGRAM_ID,
                            currencyTokenProgram: TOKEN_PROGRAM_ID,
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
                await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
                    skipPreflight: false,
                });

                const [positionAfter, [vaultAfter, ownerTokenAAfter, ownerBAfter, feeBalanceAfter]] = await Promise.all([
                    program.account.position.fetchNullable(positionKey),
                    getMultipleTokenAccounts(program.provider.connection, [
                        vaultKey,
                        ownerTokenA,
                        ownerTokenB,
                        feeWallet,
                    ], TOKEN_PROGRAM_ID),
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
                assert.equal(ownerADiff, BigInt(954));

                //const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
                //assert.equal(feeBalanceDiff.toString(), closeExecutionFee.toString());
            });
        });
    });
});
