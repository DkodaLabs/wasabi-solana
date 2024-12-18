import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
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

    const feeWalletA = getAssociatedTokenAddressSync(
        tokenMintA,
        feeWalletKeypair.publicKey,
        true,
        TOKEN_PROGRAM_ID
    );

    const liquidationWalletA = getAssociatedTokenAddressSync(
        tokenMintA,
        liquidationWalletKeypair.publicKey,
        true,
        TOKEN_PROGRAM_ID
    );

    const [feeWallet] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("protocol_wallet"),
            globalSettingsKey.toBuffer(),
            Buffer.from([0]),
            Buffer.from([1]),
        ],
        program.programId,
    );

    const [liquidationWallet] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("protocol_wallet"),
            globalSettingsKey.toBuffer(),
            Buffer.from([1]),
            Buffer.from([1]),
        ],
        program.programId,
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

                const args = {
                    minTargetAmount: new anchor.BN(0),
                    interest: new anchor.BN(10),
                    executionFee: new anchor.BN(11),
                    expiration: closeRequestExpiration,
                };
                const setupIx = await program.methods
                    .closeLongPositionSetup(
                        args.minTargetAmount,
                        args.interest,
                        args.executionFee,
                        args.expiration,
                    )
                    .accounts({
                        owner: user2.publicKey,
                        closePositionSetup: {
                            pool: longPoolBKey,
                            owner: user2.publicKey,
                            collateral: tokenMintB,
                            position: positionKey,
                            permission: coSignerPermission,
                            // @ts-ignore
                            authority: SWAP_AUTHORITY.publicKey,
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
                        .closeLongPositionCleanup()
                        .accountsPartial({
                            owner: user2.publicKey,
                            closePositionCleanup: {
                                owner: user2.publicKey,
                                ownerPayoutAccount: ownerTokenA,
                                pool: longPoolBKey,
                                position: positionKey,
                                currency: tokenMintA,
                                collateral: tokenMintB,
                                authority: SWAP_AUTHORITY.publicKey,
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

                const args = {
                    minTargetAmount: new anchor.BN(0),
                    interest: new anchor.BN(10),
                    executionFee: new anchor.BN(11),
                    expiration: closeRequestExpiration,
                };
                const setupIx = await program.methods
                    .closeLongPositionSetup(
                        args.minTargetAmount,
                        args.interest,
                        args.executionFee,
                        args.expiration
                    )
                    .accounts({
                        owner: program.provider.publicKey,
                        closePositionSetup: {
                            pool: longPoolBKey,
                            owner: program.provider.publicKey,
                            collateral: tokenMintB,
                            position: positionKey,
                            permission: badCoSignerPermission,
                            // @ts-ignore
                            authority: NON_SWAP_AUTHORITY.publicKey,
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
                        .closeLongPositionCleanup()
                        .accountsPartial({
                            owner: program.provider.publicKey,
                            closePositionCleanup: {
                                owner: program.provider.publicKey,
                                ownerPayoutAccount: ownerTokenA,
                                pool: longPoolBKey,
                                position: positionKey,
                                currency: tokenMintA,
                                collateral: tokenMintB,
                                authority: NON_SWAP_AUTHORITY.publicKey,
                                feeWallet: feeWalletA,
                                liquidationWallet: liquidationWalletA,
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
                        executionFee: new anchor.BN(11),
                        expiration: closeRequestExpiration,
                    };
                    const setupIx = await program.methods
                        .closeLongPositionSetup(
                            args.minTargetAmount,
                            args.interest,
                            args.executionFee,
                            args.expiration,
                        )
                        .accounts({
                            owner: program.provider.publicKey,
                            closePositionSetup: {
                                pool: longPoolBKey,
                                owner: program.provider.publicKey,
                                collateral: tokenMintB,
                                position: positionKey,
                                permission: coSignerPermission,
                                // @ts-ignore
                                authority: SWAP_AUTHORITY.publicKey,
                                tokenProgram: TOKEN_PROGRAM_ID,
                            },
                        })
                        .instruction();
                    await program.methods
                        .closeLongPositionCleanup()
                        .accountsPartial({
                            owner: program.provider.publicKey,
                            closePositionCleanup: {
                                owner: program.provider.publicKey,
                                ownerPayoutAccount: ownerTokenA,
                                pool: longPoolBKey,
                                position: positionKey,
                                currency: tokenMintA,
                                collateral: tokenMintB,
                                authority: SWAP_AUTHORITY.publicKey,
                                feeWallet: feeWalletA,
                                liquidationWallet: liquidationWalletA,
                                collateralTokenProgram: TOKEN_PROGRAM_ID,
                                currencyTokenProgram: TOKEN_PROGRAM_ID,
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
                    const args = {
                        minTargetAmount: new anchor.BN(0),
                        interest: new anchor.BN(10),
                        executionFee: new anchor.BN(11),
                        expiration: closeRequestExpiration,
                    };
                    await program.methods
                        .closeLongPositionSetup(
                            args.minTargetAmount,
                            args.interest,
                            args.executionFee,
                            args.expiration,
                        )
                        .accounts({
                            owner: program.provider.publicKey,
                            closePositionSetup: {
                                pool: longPoolBKey,
                                owner: program.provider.publicKey,
                                collateral: tokenMintB,
                                position: positionKey,
                                permission: coSignerPermission,
                                // @ts-ignore
                                authority: SWAP_AUTHORITY.publicKey,
                                tokenProgram: TOKEN_PROGRAM_ID,
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
        describe("user tries to close a position with bad debt", () => {
            it("should fail with BadDebt error", async () => {
                // Setup: (currency vault is empty, collateral has balance from open position)
                const setupIx = await program.methods
                    .closeLongPositionSetup(
                        new anchor.BN(0),
                        new anchor.BN(10), // interest
                        new anchor.BN(11), // execution fee
                        new anchor.BN(Math.floor(Date.now() / 1000) + 3600)
                    )
                    .accounts({
                        owner: program.provider.publicKey,
                        closePositionSetup: {
                            pool: longPoolBKey,
                            owner: program.provider.publicKey,
                            collateral: tokenMintB,
                            position: positionKey,
                            permission: coSignerPermission,
                            //@ts-ignore
                            authority: SWAP_AUTHORITY.publicKey,
                            tokenProgram: TOKEN_PROGRAM_ID,
                        },
                    })
                    .instruction();

                // After setup: drain collateral and mint small amount to currency
                const drainCollateralIx = createTransferInstruction(
                    longPoolBVaultKey,
                    ownerTokenB,
                    SWAP_AUTHORITY.publicKey,
                    1800, // Leave small amount from the ~1900 we got from opening
                    [SWAP_AUTHORITY],
                    TOKEN_PROGRAM_ID
                );

                // Mint small amount to currency to ensure positive delta but not enough for principal (1000)
                const mintCurrencyIx = createMintToInstruction(
                    tokenMintA,
                    longPoolBCurrencyVaultKey,
                    program.provider.publicKey,
                    500, // Not enough to cover principal of 1000
                    undefined,
                    TOKEN_PROGRAM_ID
                );

                try {
                    const _tx = await program.methods
                        .closeLongPositionCleanup()
                        .accountsPartial({
                            owner: program.provider.publicKey,
                            closePositionCleanup: {
                                owner: program.provider.publicKey,
                                ownerPayoutAccount: ownerTokenA,
                                pool: longPoolBKey,
                                position: positionKey,
                                currency: tokenMintA,
                                collateral: tokenMintB,
                                authority: SWAP_AUTHORITY.publicKey,
                                feeWallet: feeWalletA,
                                liquidationWallet: liquidationWalletA,
                                collateralTokenProgram: TOKEN_PROGRAM_ID,
                                currencyTokenProgram: TOKEN_PROGRAM_ID,
                            },
                        })
                        .preInstructions([
                            setupIx,
                            drainCollateralIx,
                            mintCurrencyIx,
                        ])
                        .transaction();

                    const connection = program.provider.connection;
                    const lookupAccount = await connection
                        .getAddressLookupTable(openPosLut)
                        .catch(() => null);
                    const message = new web3.TransactionMessage({
                        instructions: _tx.instructions,
                        payerKey: program.provider.publicKey!,
                        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                    }).compileToV0Message([lookupAccount.value]);

                    const tx = new web3.VersionedTransaction(message);
                    await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
                        skipPreflight: false,
                    });


                    assert.fail("Expected transaction to fail with BadDebt error");
                } catch (e: any) {
                    const err = anchor.translateError(
                        e,
                        anchor.parseIdlErrors(program.idl)
                    );
                    if (err instanceof anchor.AnchorError) {

                        assert.equal(err.error.errorCode.number, 6011);
                    } else if (err instanceof anchor.ProgramError) {
                        assert.equal(err.code, 6011);
                    } else {
                        assert.ok(false);
                    }
                }
            });
        });

        describe("correct setup", () => {
            it("should close the position and return funds", async () => {
                const interestOwed = new anchor.BN(1);
                //                const closeFee = new anchor.BN(11);
                const positionBefore = await program.account.position.fetch(
                    positionKey
                );
                const vaultKey = getAssociatedTokenAddressSync(
                    positionBefore.currency,
                    lpVaultKey,
                    true
                );
                const [lpVaultBefore, [vaultBefore, ownerABefore, feeBalanceBefore]] =
                    await Promise.all([
                        program.account.lpVault.fetchNullable(lpVaultKey),
                        getMultipleTokenAccounts(program.provider.connection, [
                            vaultKey,
                            ownerTokenA,
                            feeWalletA
                        ], TOKEN_PROGRAM_ID)
                    ]);
                const args = {
                    minTargetAmount: new anchor.BN(0),
                    interest: interestOwed,
                    executionFee: new anchor.BN(11),
                    expiration: closeRequestExpiration,
                };
                const setupIx = await program.methods
                    .closeLongPositionSetup(
                        args.minTargetAmount,
                        args.interest,
                        args.executionFee,
                        args.expiration,
                    )
                    .accounts({
                        owner: program.provider.publicKey,
                        closePositionSetup: {
                            pool: longPoolBKey,
                            owner: program.provider.publicKey,
                            collateral: tokenMintB,
                            position: positionKey,
                            permission: coSignerPermission,
                            // @ts-ignore
                            authority: SWAP_AUTHORITY.publicKey,
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
                    .closeLongPositionCleanup()
                    .accountsPartial({
                        owner: program.provider.publicKey,
                        closePositionCleanup: {
                            owner: program.provider.publicKey,
                            ownerPayoutAccount: ownerTokenA,
                            pool: longPoolBKey,
                            position: positionKey,
                            currency: tokenMintA,
                            collateral: tokenMintB,
                            authority: SWAP_AUTHORITY.publicKey,
                            feeWallet: feeWalletA,
                            liquidationWallet: liquidationWalletA,
                            collateralTokenProgram: TOKEN_PROGRAM_ID,
                            currencyTokenProgram: TOKEN_PROGRAM_ID,
                        },
                    })
                    .preInstructions([setupIx, swapIx])
                    .transaction();

                try {
                    const connection = program.provider.connection;
                    const lookupAccount = await connection
                        .getAddressLookupTable(openPosLut)
                        .catch(() => null);
                    const message = new web3.TransactionMessage({
                        instructions: _tx.instructions,
                        payerKey: program.provider.publicKey!,
                        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                    }).compileToV0Message([lookupAccount.value]);

                    const tx = new web3.VersionedTransaction(message);
                    await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
                        skipPreflight: false,
                    });
                } catch (e: any) {
                    console.log(e);
                }

                const [lpVaultAfter, positionAfter, [vaultAfter, ownerAAfter, feeWalletAAfter]] =
                    await Promise.all([
                        program.account.lpVault.fetchNullable(lpVaultKey),
                        program.account.position.fetchNullable(positionKey),
                        getMultipleTokenAccounts(program.provider.connection, [
                            vaultKey,
                            ownerTokenA,
                            feeWalletA
                        ], TOKEN_PROGRAM_ID),
                    ]);
                assert.isNull(positionAfter);

                // should pay back interest + principal to LP Vault
                const expectedLpVaultDiff = positionBefore.principal.add(interestOwed);
                const vaultDiff = vaultAfter.amount - vaultBefore.amount;
                assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString());


                // Validate the user got the rest
                const ownerADiff = ownerAAfter.amount - ownerABefore.amount;
                assert.equal(ownerADiff.toString(), "939");


                // we expect the totalAssets of the lpVault to be incremented by the interestOwed
                assert.equal(lpVaultAfter.totalAssets.sub(lpVaultBefore.totalAssets).toString(), interestOwed.toString());
            });
        });
    });
});
