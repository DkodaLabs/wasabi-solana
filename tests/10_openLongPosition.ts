import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
    createTransferInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    abSwapKey,
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
} from "./rootHooks";
import { getMultipleTokenAccounts } from "./utils";
import { TOKEN_SWAP_PROGRAM_ID, TokenSwap } from "@solana/spl-token-swap";
import { web3 } from "@coral-xyz/anchor";

describe("OpenLongPosition", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
    const [coSignerPermission] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("admin"),
            SWAP_AUTHORITY.publicKey.toBuffer(),
        ],
        program.programId,
    );

    const [globalSettingsKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("global_settings")],
        program.programId,

    );

    const [feeWalletKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("protocol_wallet"),
            globalSettingsKey.toBuffer(),
            Buffer.from([0]),
            Buffer.from([1]),
        ],
        program.programId,
    );

    const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
        program.programId,
    );
    const ownerTokenA = getAssociatedTokenAddressSync(
        tokenMintA,
        program.provider.publicKey,
        false,
    );
    const [longPoolBKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("long_pool"),
            tokenMintB.toBuffer(),
            tokenMintA.toBuffer(),
        ],
        program.programId,
    );
    const longPoolBVaultKey = getAssociatedTokenAddressSync(
        tokenMintB,
        longPoolBKey,
        true,
    );
    const longPoolBCurrencyVaultKey = getAssociatedTokenAddressSync(
        tokenMintA,
        longPoolBKey,
        true,
    );
    const [openPositionRequestKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("open_pos"),
            program.provider.publicKey.toBuffer(),
        ],
        program.programId,
    );

    before(async () => {
        // Create LongPool for `tokenMintB` as that will be the collateral held.
        const [superAdminPermissionKey] =
            anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("super_admin")],
                program.programId,
            );
        await superAdminProgram.methods
            .initLongPool()
            .accounts({
                payer: superAdminProgram.provider.publicKey,
                permission: superAdminPermissionKey,
                collateral: tokenMintB,
                currency: tokenMintA,
                collateralTokenProgram: TOKEN_PROGRAM_ID,
                currencyTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
    });

    describe("with more than one setup IX", () => {
        it("should fail", async () => {
            const nonce = 100;
            const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [
                    anchor.utils.bytes.utf8.encode("position"),
                    program.provider.publicKey.toBuffer(),
                    longPoolBKey.toBuffer(),
                    lpVaultKey.toBuffer(),
                    new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
                ],
                program.programId,
            );
            try {
                const now = new Date().getTime() / 1_000;
                const args = {
                    nonce,
                    minTargetAmount: new anchor.BN(1_900),
                    downPayment: new anchor.BN(1_000),
                    principal: new anchor.BN(1_000),
                    fee: new anchor.BN(10),
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
                    .accountsPartial({
                        owner: program.provider.publicKey,
                        lpVault: lpVaultKey,
                        pool: longPoolBKey,
                        collateral: tokenMintB,
                        currency: tokenMintA,
                        authority: SWAP_AUTHORITY.publicKey,
                        permission: coSignerPermission,
                        feeWallet: feeWalletKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .instruction();

                await program.methods
                    .openLongPositionCleanup()
                    .accounts({
                        owner: program.provider.publicKey,
                        pool: longPoolBKey,
                        position: positionKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
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
                    console.log(err);
                    assert.ok(false);
                }
            }
        });
    });

    describe("without cleanup IX", () => {
        it("should fail", async () => {
            try {
                const now = new Date().getTime() / 1_000;
                const args = {
                    nonce: 100,
                    minTargetAmount: new anchor.BN(1_900),
                    downPayment: new anchor.BN(1_000),
                    principal: new anchor.BN(1_000),
                    expiration: new anchor.BN(now + 3_600),
                    fee: new anchor.BN(10),
                };
                await program.methods
                    .openLongPositionSetup(
                        args.nonce,
                        args.minTargetAmount,
                        args.downPayment,
                        args.principal,
                        args.fee,
                        args.expiration,
                    )
                    .accountsPartial({
                        owner: program.provider.publicKey,
                        lpVault: lpVaultKey,
                        pool: longPoolBKey,
                        collateral: tokenMintB,
                        currency: tokenMintA,
                        authority: SWAP_AUTHORITY.publicKey,
                        permission: coSignerPermission,
                        feeWallet: feeWalletKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
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

    describe("with one setup and one cleanup ", () => {
        it("should open a new position", async () => {
            const nonce = 0;
            const fee = new anchor.BN(10);
            const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [
                    anchor.utils.bytes.utf8.encode("position"),
                    program.provider.publicKey.toBuffer(),
                    longPoolBKey.toBuffer(),
                    lpVaultKey.toBuffer(),
                    new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
                ],
                program.programId,
            );
            const now = new Date().getTime() / 1_000;

            const lpVault = await program.account.lpVault.fetch(lpVaultKey);
            const [lpVaultBefore, ownerTokenABefore, longPoolBVaultBefore] =
                await getMultipleTokenAccounts(program.provider.connection, [
                    lpVault.vault,
                    ownerTokenA,
                    longPoolBVaultKey,
                ], TOKEN_PROGRAM_ID);

            const downPayment = new anchor.BN(1_000);
            // amount to be borrowed
            const principal = new anchor.BN(1_000);
            const swapAmount = downPayment.add(principal);
            const minimumAmountOut = new anchor.BN(1_900);

            const setupIx = await program.methods
                .openLongPositionSetup(
                    nonce,
                    minimumAmountOut,
                    downPayment,
                    principal,
                    fee,
                    new anchor.BN(now + 3_600),
                ).accountsPartial({
                    owner: program.provider.publicKey,
                    lpVault: lpVaultKey,
                    pool: longPoolBKey,
                    collateral: tokenMintB,
                    currency: tokenMintA,
                    authority: SWAP_AUTHORITY.publicKey,
                    permission: coSignerPermission,
                    feeWallet: feeWalletKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction();
            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
                [abSwapKey.publicKey.toBuffer()],
                TOKEN_SWAP_PROGRAM_ID,
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
                BigInt(minimumAmountOut.toString()),
            );

            const _tx = await program.methods
                .openLongPositionCleanup()
                .accounts({
                    owner: program.provider.publicKey,
                    pool: longPoolBKey,
                    position: positionKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .preInstructions([setupIx, swapIx])
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

            const [
                [lpVaultAfter, ownerTokenAAfter, longPoolBVaultAfter],
                openPositionRequestAfter,
                positionAfter,
            ] = await Promise.all([
                getMultipleTokenAccounts(program.provider.connection, [
                    lpVault.vault,
                    ownerTokenA,
                    longPoolBVaultKey,
                    longPoolBCurrencyVaultKey,
                ], TOKEN_PROGRAM_ID),
                program.provider.connection.getAccountInfo(openPositionRequestKey),
                program.account.position.fetch(positionKey),
            ]);

            // Assert position has correct values
            assert.equal(
                positionAfter.trader.toString(),
                program.provider.publicKey.toString(),
            );
            assert.ok(positionAfter.collateralAmount.gt(new anchor.BN(0)));
            assert.equal(
                positionAfter.collateral.toString(),
                tokenMintB.toString(),
            );
            assert.equal(
                positionAfter.collateralVault.toString(),
                longPoolBVaultKey.toString(),
            );
            assert.equal(positionAfter.currency.toString(), tokenMintA.toString());
            assert.equal(
                positionAfter.downPayment.toString(),
                downPayment.toString(),
            );
            assert.equal(positionAfter.principal.toString(), principal.toString());
            assert.equal(positionAfter.lpVault.toString(), lpVaultKey.toString());

            // Assert vault balance decreased by Principal
            assert.equal(
                lpVaultAfter.amount,
                lpVaultBefore.amount - BigInt(principal.toString()),
            );
            // Assert user balance decreased by downpayment
            assert.equal(
                ownerTokenAAfter.amount,
                ownerTokenABefore.amount -
                BigInt(downPayment.toString()) -
                BigInt(fee.toString()),
            );
            // Assert collateral vault balance has increased
            assert.isTrue(longPoolBVaultAfter.amount > longPoolBVaultBefore.amount);

            // Assert the open position request account was closed
            assert.isNull(openPositionRequestAfter);
        });

        it("should fail with noop", async () => {
            const nonce = 100;
            const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [
                    anchor.utils.bytes.utf8.encode("position"),
                    program.provider.publicKey.toBuffer(),
                    longPoolBKey.toBuffer(),
                    lpVaultKey.toBuffer(),
                    new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
                ],
                program.programId,
            );
            const now = new Date().getTime() / 1_000;

            const downPayment = new anchor.BN(1_000);
            // amount to be borrowed
            const principal = new anchor.BN(1_000);
            const minimumAmountOut = new anchor.BN(1_900);
            try {
                const args = {
                    nonce,
                    minTargetAmount: minimumAmountOut,
                    downPayment,
                    principal,
                    fee: new anchor.BN(10),
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
                    .accountsPartial({
                        owner: program.provider.publicKey,
                        lpVault: lpVaultKey,
                        pool: longPoolBKey,
                        collateral: tokenMintB,
                        currency: tokenMintA,
                        authority: SWAP_AUTHORITY.publicKey,
                        permission: coSignerPermission,
                        feeWallet: feeWalletKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .instruction();
                await program.methods
                    .openLongPositionCleanup()
                    .accounts({
                        owner: program.provider.publicKey,
                        pool: longPoolBKey,
                        position: positionKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .preInstructions([setupIx])
                    .signers([SWAP_AUTHORITY])
                    .rpc({ skipPreflight: true });
                assert.ok(false);
            } catch (err) {
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6004);
                } else if (err instanceof anchor.ProgramError) {
                    assert.equal(err.code, 6004);
                } else {
                    assert.ok(false);
                }
            }
        });

        it("should fail with using more than downpayment + principal", async () => {
            const nonce = 100;
            const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [
                    anchor.utils.bytes.utf8.encode("position"),
                    program.provider.publicKey.toBuffer(),
                    longPoolBKey.toBuffer(),
                    lpVaultKey.toBuffer(),
                    new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
                ],
                program.programId,
            );
            const now = new Date().getTime() / 1_000;

            const downPayment = new anchor.BN(1_000);
            // amount to be borrowed
            const principal = new anchor.BN(1_000);
            const minimumAmountOut = new anchor.BN(1_900);
            try {
                const transferAmount = 3_000;
                const transferIX = createTransferInstruction(
                    ownerTokenA,
                    longPoolBCurrencyVaultKey,
                    program.provider.publicKey,
                    transferAmount,
                );
                const args = {
                    nonce,
                    minTargetAmount: minimumAmountOut,
                    downPayment,
                    principal,
                    fee: new anchor.BN(10),
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
                    .accountsPartial({
                        owner: program.provider.publicKey,
                        lpVault: lpVaultKey,
                        pool: longPoolBKey,
                        collateral: tokenMintB,
                        currency: tokenMintA,
                        authority: SWAP_AUTHORITY.publicKey,
                        permission: coSignerPermission,
                        feeWallet: feeWalletKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .instruction();
                const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
                    [abSwapKey.publicKey.toBuffer()],
                    TOKEN_SWAP_PROGRAM_ID,
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
                    BigInt(3_000),
                    BigInt(minimumAmountOut.toString()),
                );
                const _tx = await program.methods
                    .openLongPositionCleanup()
                    .accounts({
                        owner: program.provider.publicKey,
                        pool: longPoolBKey,
                        position: positionKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .preInstructions([transferIX, setupIx, swapIx])
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
                assert.ok(false);
            } catch (err) {
                console.log(err);
                assert.ok(
                    err.toString().includes(`"InstructionError":[2,{"Custom":1}]`),
                );
            }
        });

        it("should fail with incorrect pool", async () => {
            const nonce = 100;
            const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [
                    anchor.utils.bytes.utf8.encode("position"),
                    program.provider.publicKey.toBuffer(),
                    longPoolBKey.toBuffer(),
                    lpVaultKey.toBuffer(),
                    new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
                ],
                program.programId,
            );
            const [superAdminPermissionKey] =
                anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("super_admin")],
                    program.programId,
                );
            await superAdminProgram.methods
                .initShortPool()
                .accounts({
                    payer: superAdminProgram.provider.publicKey,
                    permission: superAdminPermissionKey,
                    collateral: tokenMintB,
                    currency: tokenMintA,
                    collateralTokenProgram: TOKEN_PROGRAM_ID,
                    currencyTokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();
            const [shortPoolBKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [
                    anchor.utils.bytes.utf8.encode("short_pool"),
                    tokenMintB.toBuffer(),
                    tokenMintA.toBuffer(),
                ],
                program.programId,
            );
            const now = new Date().getTime() / 1_000;

            const downPayment = new anchor.BN(1_000);
            // amount to be borrowed
            const principal = new anchor.BN(1_000);
            const minimumAmountOut = new anchor.BN(1_900);
            try {
                const args = {
                    nonce,
                    minTargetAmount: minimumAmountOut,
                    downPayment,
                    principal,
                    fee: new anchor.BN(10),
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
                    .accountsPartial({
                        owner: program.provider.publicKey,
                        lpVault: lpVaultKey,
                        pool: longPoolBKey,
                        collateral: tokenMintB,
                        currency: tokenMintA,
                        authority: SWAP_AUTHORITY.publicKey,
                        permission: coSignerPermission,
                        feeWallet: feeWalletKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .instruction();
                const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
                    [abSwapKey.publicKey.toBuffer()],
                    TOKEN_SWAP_PROGRAM_ID,
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
                    BigInt(downPayment.add(principal).toString()),
                    BigInt(minimumAmountOut.toString()),
                );
                const _tx = await program.methods
                    .openLongPositionCleanup()
                    .accounts({
                        owner: program.provider.publicKey,
                        pool: shortPoolBKey,
                        position: positionKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .preInstructions([setupIx, swapIx])
                    // .signers([SWAP_AUTHORITY])
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
                assert.ok(false);
            } catch (err) {
                const regex = /Error Code: InvalidPool. Error Number: 6006/
                const match = err.toString().match(regex);
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6006);
                } else if (err instanceof anchor.ProgramError) {
                    assert.equal(err.code, 6006);
                } else if (match) {
                    assert.ok(true);
                } else {
                    assert.ok(false);
                }
            }
        });

        it("should fail with incorrect position", async () => {
            const nonce = 100;
            const [badPositionKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [
                    anchor.utils.bytes.utf8.encode("position"),
                    program.provider.publicKey.toBuffer(),
                    longPoolBKey.toBuffer(),
                    lpVaultKey.toBuffer(),
                    new anchor.BN(0).toArrayLike(Buffer, "le", 2),
                ],
                program.programId,
            );
            const now = new Date().getTime() / 1_000;

            const downPayment = new anchor.BN(1_000);
            // amount to be borrowed
            const principal = new anchor.BN(1_000);
            const minimumAmountOut = new anchor.BN(1_900);
            try {
                const args = {
                    nonce,
                    minTargetAmount: minimumAmountOut,
                    downPayment,
                    principal,
                    fee: new anchor.BN(10),
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
                    .accountsPartial({
                        owner: program.provider.publicKey,
                        lpVault: lpVaultKey,
                        pool: longPoolBKey,
                        collateral: tokenMintB,
                        currency: tokenMintA,
                        authority: SWAP_AUTHORITY.publicKey,
                        permission: coSignerPermission,
                        feeWallet: feeWalletKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .instruction();
                const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
                    [abSwapKey.publicKey.toBuffer()],
                    TOKEN_SWAP_PROGRAM_ID,
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
                    BigInt(downPayment.add(principal).toString()),
                    BigInt(minimumAmountOut.toString()),
                );
                const _tx = await program.methods
                    .openLongPositionCleanup()
                    .accounts({
                        owner: program.provider.publicKey,
                        pool: longPoolBKey,
                        position: badPositionKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .preInstructions([setupIx, swapIx])
                    .transaction()

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

                assert.ok(false);
            } catch (e: any) {
                const err = anchor.translateError(
                    e,
                    anchor.parseIdlErrors(program.idl)
                );
                if (err instanceof anchor.AnchorError) {

                    assert.equal(err.error.errorCode.number, 6007);
                } else if (err instanceof anchor.ProgramError) {
                    assert.equal(err.code, 6007);
                } else {
                    assert.ok(false);
                }
            }
        });
    });

    describe("Without swap co-signer", () => {
        it("Should fail", async () => {
            const nonce = 1;
            const [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [
                    anchor.utils.bytes.utf8.encode("position"),
                    program.provider.publicKey.toBuffer(),
                    longPoolBKey.toBuffer(),
                    lpVaultKey.toBuffer(),
                    new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
                ],
                program.programId,
            );
            const now = new Date().getTime() / 1_000;

            const downPayment = new anchor.BN(1_000);
            // amount to be borrowed
            const principal = new anchor.BN(1_000);
            const swapAmount = downPayment.add(principal);
            const minimumAmountOut = new anchor.BN(1_900);

            const [badCoSignerPermission] =
                anchor.web3.PublicKey.findProgramAddressSync(
                    [
                        anchor.utils.bytes.utf8.encode("admin"),
                        NON_SWAP_AUTHORITY.publicKey.toBuffer(),
                    ],
                    program.programId,
                );

            const args = {
                nonce,
                minTargetAmount: minimumAmountOut,
                downPayment,
                principal,
                fee: new anchor.BN(10),
                expiration: new anchor.BN(now + 3_600),
            }

            const setupIx = await program.methods
                .openLongPositionSetup(
                    args.nonce,
                    args.minTargetAmount,
                    args.downPayment,
                    args.principal,
                    args.fee,
                    args.expiration,
                )
                .accountsPartial({
                    owner: program.provider.publicKey,
                    lpVault: lpVaultKey,
                    pool: longPoolBKey,
                    collateral: tokenMintB,
                    currency: tokenMintA,
                    authority: NON_SWAP_AUTHORITY.publicKey,
                    permission: badCoSignerPermission,
                    feeWallet: feeWalletKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction();
            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
                [abSwapKey.publicKey.toBuffer()],
                TOKEN_SWAP_PROGRAM_ID,
            );
            const swapIx = TokenSwap.swapInstruction(
                abSwapKey.publicKey,
                swapAuthority,
                NON_SWAP_AUTHORITY.publicKey,
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
                BigInt(minimumAmountOut.toString()),
            );
            try {
                await program.methods
                    .openLongPositionCleanup()
                    .accounts({
                        owner: program.provider.publicKey,
                        pool: longPoolBKey,
                        position: positionKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .preInstructions([setupIx, swapIx])
                    .signers([NON_SWAP_AUTHORITY])
                    .rpc({ skipPreflight: true });
                assert.ok(false);
            } catch (err) {
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6008);
                } else if (err instanceof anchor.ProgramError) {
                    assert.equal(err.code, 6008);
                } else {
                    console.log(err);
                    assert.ok(false);
                }
            }
        });
    });
});
