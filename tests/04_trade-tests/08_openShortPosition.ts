import {TradeContext, defaultOpenShortPositionArgs} from './tradeContext';
import {validateOpenShortPosition} from './validateTrade';
import {
    openShortPositionWithInvalidSetup,
    openShortPositionWithoutCleanup,
    openShortPositionWithInvalidPool,
    openShortPositionWithInvalidPosition,
    openShortPositionWithoutCosigner,
} from './invalidTrades';

describe("OpenShortPosition", () => {
    let ctx: TradeContext

    before(async () => {
        ctx = await new TradeContext().generateShortTest();
    });

    describe("with more than one setup instruction", () => {
        it("should fail", async () => {
            await openShortPositionWithInvalidSetup(ctx);
        });
    });

    describe("without a cleanup instruction", () => {
        it("should fail", async () => {
            await openShortPositionWithoutCleanup(ctx);
        });
    })

    describe("with one setup and one cleanup ix", () => {
        describe("when amount swapped is more than the sum of downpayment + principal", () => {
            it("should fail", async () => {
                await validateOpenShortPosition(ctx, {...defaultOpenShortPositionArgs, swapIn: BigInt(3_000)});
            });
        });

        describe("with a different pool in the cleanup instruction", () => {
            it("should fail", async () => {
                await openShortPositionWithInvalidPool(ctx);
            });
        });

        describe("with an incorrect position", () => {
            it("should fail", async () => {
                await openShortPositionWithInvalidPosition(ctx);
            });
        });

        describe("without a swap co-signer", () => {
            it("should fail", async () => {
                await openShortPositionWithoutCosigner(ctx);
            });
        });

        describe("correct parameters", () => {
            it("should correctly open a new position", async () => {
                await validateOpenShortPosition(ctx);
            });
        });
    });
});


//
//        it("should fail when minTargetAmount is not met", async () => {
//            const nonce = 100;
//            const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
//                [
//                    anchor.utils.bytes.utf8.encode("position"),
//                    program.provider.publicKey.toBuffer(),
//                    shortPoolAKey.toBuffer(),
//                    lpVaultKey.toBuffer(),
//                    new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
//                ],
//                program.programId,
//            );
//            const now = new Date().getTime() / 1_000;
//
//            const downPayment = new anchor.BN(1_000);
//            // amount to be borrowed
//            const principal = new anchor.BN(1_000);
//            const minTargetAmount = new anchor.BN(1_000_000);
//            const args = {
//                nonce,
//                minTargetAmount,
//                downPayment,
//                principal,
//                fee: new anchor.BN(10),
//                expiration: new anchor.BN(now + 3_600),
//            };
//            try {
//                const setupIx = await program.methods
//                    .openShortPositionSetup(
//                        args.nonce,
//                        args.minTargetAmount,
//                        args.downPayment,
//                        args.principal,
//                        args.fee,
//                        args.expiration,
//                    )
//                    .accountsPartial({
//                        owner: program.provider.publicKey,
//                        lpVault: lpVaultKey,
//                        pool: shortPoolAKey,
//                        currency: tokenMintB,
//                        collateral: tokenMintA,
//                        permission: coSignerPermission,
//                        authority: SWAP_AUTHORITY.publicKey,
//                        feeWallet: feeWalletA,
//                        currencyTokenProgram: TOKEN_PROGRAM_ID,
//                        collateralTokenProgram: TOKEN_PROGRAM_ID,
//                    })
//                    .instruction();
//                const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                    [abSwapKey.publicKey.toBuffer()],
//                    TOKEN_SWAP_PROGRAM_ID,
//                );
//
//                const swapIx = TokenSwap.swapInstruction(
//                    abSwapKey.publicKey,
//                    swapAuthority,
//                    SWAP_AUTHORITY.publicKey,
//                    shortPoolACurrencyVaultKey,
//                    swapTokenAccountB,
//                    swapTokenAccountA,
//                    shortPoolAVaultKey,
//                    poolMint,
//                    poolFeeAccount,
//                    null,
//                    tokenMintB,
//                    tokenMintA,
//                    TOKEN_SWAP_PROGRAM_ID,
//                    TOKEN_PROGRAM_ID,
//                    TOKEN_PROGRAM_ID,
//                    TOKEN_PROGRAM_ID,
//                    BigInt(principal.toString()),
//                    BigInt(0),
//                );
//                await program.methods
//                    .openShortPositionCleanup()
//                    .accounts({
//                        owner: program.provider.publicKey,
//                        pool: shortPoolAKey,
//                        //@ts-ignore
//                        lpVault: lpVaultKey,
//                        collateral: tokenMintA,
//                        currency: tokenMintB,
//                        position: positionKey,
//                        tokenProgram: TOKEN_PROGRAM_ID,
//                    })
//                    .preInstructions([setupIx, swapIx])
//                    .signers([SWAP_AUTHORITY])
//                    .rpc({ skipPreflight: true });
//                assert.ok(false);
//            } catch (err) {
//                if (err instanceof anchor.AnchorError) {
//                    assert.equal(err.error.errorCode.number, 6004);
//                } else if (err instanceof anchor.ProgramError) {
//                    assert.equal(err.code, 6004);
//                } else {
//                    assert.ok(false);
//                }
//            }
//        });
//
//        it("should fail when more than principal is swapped", async () => {
//            const nonce = 100;
//            const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
//                [
//                    anchor.utils.bytes.utf8.encode("position"),
//                    program.provider.publicKey.toBuffer(),
//                    shortPoolAKey.toBuffer(),
//                    lpVaultKey.toBuffer(),
//                    new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
//                ],
//                program.programId,
//            );
//            const now = new Date().getTime() / 1_000;
//
//            const downPayment = new anchor.BN(1_000);
//            // amount to be borrowed
//            const principal = new anchor.BN(1_000);
//            const minTargetAmount = new anchor.BN(0);
//            try {
//                const transferAmount = 2_000;
//                const transferIX = createTransferInstruction(
//                    ownerTokenB,
//                    shortPoolACurrencyVaultKey,
//                    program.provider.publicKey,
//                    transferAmount,
//                );
//                const args = {
//                    nonce,
//                    minTargetAmount,
//                    downPayment,
//                    principal,
//                    fee: new anchor.BN(10),
//                    expiration: new anchor.BN(now + 3_600),
//                };
//                const setupIx = await program.methods
//                    .openShortPositionSetup(
//                        args.nonce,
//                        args.minTargetAmount,
//                        args.downPayment,
//                        args.principal,
//                        args.fee,
//                        args.expiration,
//                    )
//                    .accountsPartial({
//                        owner: program.provider.publicKey,
//                        lpVault: lpVaultKey,
//                        pool: shortPoolAKey,
//                        currency: tokenMintB,
//                        collateral: tokenMintA,
//                        permission: coSignerPermission,
//                        authority: SWAP_AUTHORITY.publicKey,
//                        feeWallet: feeWalletA,
//                        currencyTokenProgram: TOKEN_PROGRAM_ID,
//                        collateralTokenProgram: TOKEN_PROGRAM_ID,
//                    })
//                    .instruction();
//                const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                    [abSwapKey.publicKey.toBuffer()],
//                    TOKEN_SWAP_PROGRAM_ID,
//                );
//
//                const swapIx = TokenSwap.swapInstruction(
//                    abSwapKey.publicKey,
//                    swapAuthority,
//                    SWAP_AUTHORITY.publicKey,
//                    shortPoolACurrencyVaultKey,
//                    swapTokenAccountB,
//                    swapTokenAccountA,
//                    shortPoolAVaultKey,
//                    poolMint,
//                    poolFeeAccount,
//                    null,
//                    tokenMintB,
//                    tokenMintA,
//                    TOKEN_SWAP_PROGRAM_ID,
//                    TOKEN_PROGRAM_ID,
//                    TOKEN_PROGRAM_ID,
//                    TOKEN_PROGRAM_ID,
//                    BigInt(downPayment.add(principal).toString()),
//                    BigInt(0),
//                );
//                const _tx = await program.methods
//                    .openShortPositionCleanup()
//                    .accounts({
//                        owner: program.provider.publicKey,
//                        pool: shortPoolAKey,
//                        //@ts-ignore
//                        lpVault: lpVaultKey,
//                        collateral: tokenMintA,
//                        currency: tokenMintB,
//                        position: positionKey,
//                        tokenProgram: TOKEN_PROGRAM_ID,
//                    })
//                    .preInstructions([transferIX, setupIx, swapIx])
//                    .transaction();
//                const connection = program.provider.connection;
//                const lookupAccount = await connection
//                    .getAddressLookupTable(openPosLut)
//                    .catch(() => null);
//                const message = new web3.TransactionMessage({
//                    instructions: _tx.instructions,
//                    payerKey: program.provider.publicKey!,
//                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
//                }).compileToV0Message([lookupAccount.value]);
//
//                const tx = new web3.VersionedTransaction(message);
//                await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
//                    skipPreflight: true,
//                });
//                assert.ok(false);
//            } catch (err) {
//                // should fail due to `InsufficientFunds` on the TokenSwap program since the `owner`
//                // is not delegated more than `down_payment` + `principal`.
//                assert.ok(
//                    err.toString().includes(`"InstructionError":[2,{"Custom":1}]`),
//                );
//            }
//        });
//    });
//});
