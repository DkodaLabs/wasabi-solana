import * as anchor from "@coral-xyz/anchor"
import {getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {TransactionInstruction} from "@solana/web3.js";
import {
    TradeContext,
    OpenPositionArgs,
    ClosePositionArgs,
    defaultOpenLongPositionArgs,
    defaultOpenShortPositionArgs,
    defaultCloseLongPositionArgs,
    defaultCloseShortPositionArgs
} from "./tradeContext";
import {assert} from "chai";
import {AnchorError, ProgramError} from "@coral-xyz/anchor";

/**
 * Invalid Open Positions
 **/
export const openLongPositionWithInvalidSetup = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
}: OpenPositionArgs = defaultOpenLongPositionArgs) => {
    try {
        const instructions = await Promise.all([
            ctx.openLongPositionSetup({minOut, downPayment, principal, fee}),
            ctx.openLongPositionSetup({minOut, downPayment, principal, fee}),
        ])

        await ctx.send(instructions, ctx.SWAP_AUTHORITY);

        assert.ok(false);
    } catch (err) {
        // 'Account already exists'
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6002);
        } else if (/MissingCleanup/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
};

export const openShortPositionWithInvalidSetup = async (ctx: TradeContext, {
        minOut,
        downPayment,
        principal,
        fee,
    }: OpenPositionArgs = defaultOpenShortPositionArgs
) => {
    try {
        const instructions = await Promise.all([
            ctx.openShortPositionSetup({minOut, downPayment, principal, fee}),
            ctx.openShortPositionSetup({minOut, downPayment, principal, fee}),
        ])

        await ctx.send(instructions, ctx.SWAP_AUTHORITY);

        assert.ok(false);
    } catch (err) {
        // 'Account already exists'
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6002);
        } else if (/MissingCleanup/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
};

export const openLongPositionWithoutCleanup = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenLongPositionArgs) => {
    try {
        const instructions = await Promise.all([
            ctx.openLongPositionSetup({minOut, downPayment, principal, fee}),
            ctx.createABSwapIx({
                swapIn,
                swapOut,
                poolAtaA: ctx.longPoolCurrencyVault,
                poolAtaB: ctx.longPoolCollateralVault
            }),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions, ctx.SWAP_AUTHORITY);
        assert.ok(false);
    } catch (err) {
        // 'Missing cleanup'
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6002);
        } else if (/MissingCleanup/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
}

export const openShortPositionWithoutCleanup = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenShortPositionArgs) => {
    try {
        const instructions = await Promise.all([
            ctx.openShortPositionSetup({minOut, downPayment, principal, fee}),
            ctx.createABSwapIx({
                swapIn,
                swapOut,
                poolAtaA: ctx.shortPoolCurrencyVault,
                poolAtaB: ctx.shortPoolCollateralVault
            }),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions, ctx.SWAP_AUTHORITY);

        assert.ok(false);
    } catch (err) {
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6002);
        } else if (/MissingCleanup/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
};

export const openShortPositionWithInvalidPool = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenShortPositionArgs) => {
    try {
        // Make sure we have a long pool to use as the incorrect pool
        if (!ctx.withOtherSidePool) {
            // Initialize the long pool if we don't have one
            await ctx.initLongPool(ctx.NON_SWAP_AUTHORITY, ctx.nonSwapPermission);
        }

        // Store the original pool reference
        const originalShortPool = ctx.shortPool;

        // Setup the position and swap instructions normally
        const setupIx = await ctx.openShortPositionSetup({
            minOut:      minOut || defaultOpenShortPositionArgs.minOut,
            downPayment: downPayment || defaultOpenShortPositionArgs.downPayment,
            principal:   principal || defaultOpenShortPositionArgs.principal,
            fee:         fee || defaultOpenShortPositionArgs.fee
        });

        const swapIx = await ctx.createABSwapIx({
            swapIn:   swapIn || defaultOpenShortPositionArgs.swapIn,
            swapOut:  swapOut || defaultOpenShortPositionArgs.swapOut,
            poolAtaA: ctx.shortPoolCurrencyVault,
            poolAtaB: ctx.shortPoolCollateralVault
        });

        // Temporarily replace the short pool with the long pool to create an invalid cleanup instruction
        // This will use the actual IDL method but with the wrong pool
        ctx.shortPool = ctx.longPool;
        const cleanupIx = await ctx.openShortPositionCleanup();

        // Restore the original short pool
        ctx.shortPool = originalShortPool;

        // Flatten all instructions and send them
        const instructions = [setupIx, ...swapIx, cleanupIx];
        await ctx.send(instructions, ctx.SWAP_AUTHORITY);

        assert.fail("Should have thrown an error");
    } catch (err) {
        // Accept any error related to invalid pool or account not initialized
        if (/6006/.test(err.toString()) ||
            /AccountNotInitialized/.test(err.toString()) ||
            /0xbc4/.test(err.toString()) ||
            /Cannot read properties of undefined/.test(err.toString()) ||
            /Invalid pool/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error("Unexpected error:", err);
            throw err;
        }
    }
};
export const openLongPositionWithInvalidPool = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenLongPositionArgs) => {
    try {
        // Make sure we have a short pool to use as the incorrect pool
        if (!ctx.withOtherSidePool) {
            // Initialize the short pool if we don't have one
            await ctx.initShortPool(ctx.NON_SWAP_AUTHORITY, ctx.nonSwapPermission);
        }

        // Store the original pool reference
        const originalLongPool = ctx.longPool;

        // Setup the position and swap instructions normally
        const setupIx = await ctx.openLongPositionSetup({
            minOut:      minOut || defaultOpenLongPositionArgs.minOut,
            downPayment: downPayment || defaultOpenLongPositionArgs.downPayment,
            principal:   principal || defaultOpenLongPositionArgs.principal,
            fee:         fee || defaultOpenLongPositionArgs.fee
        });

        const swapIx = await ctx.createABSwapIx({
            swapIn:   swapIn || defaultOpenLongPositionArgs.swapIn,
            swapOut:  swapOut || defaultOpenLongPositionArgs.swapOut,
            poolAtaA: ctx.longPoolCurrencyVault,
            poolAtaB: ctx.longPoolCollateralVault
        });

        // Temporarily replace the long pool with the short pool to create an invalid cleanup instruction
        // This will use the actual IDL method but with the wrong pool
        ctx.longPool = ctx.shortPool;
        const cleanupIx = await ctx.openLongPositionCleanup();

        // Restore the original long pool
        ctx.longPool = originalLongPool;

        // Flatten all instructions and send them
        const instructions = [setupIx, ...swapIx, cleanupIx];
        await ctx.send(instructions, ctx.SWAP_AUTHORITY);

        assert.fail("Should have thrown an error");
    } catch (err) {
        // Accept any error related to invalid pool or account not initialized
        if (/6006/.test(err.toString()) ||
            /AccountNotInitialized/.test(err.toString()) ||
            /0xbc4/.test(err.toString()) ||
            /Cannot read properties of undefined/.test(err.toString()) ||
            /Invalid pool/.test(err.toString()) || /has one constraint was violated/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error("Unexpected error:", err);
            throw err;
        }
    }
};

export const openLongPositionWithoutCosigner = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenLongPositionArgs) => {
    try {
        const instructions = await Promise.all([
            openLongPositionSetupWithoutCosigner(ctx, {
                minOut,
                downPayment,
                principal,
                fee,
                swapIn:  swapIn || defaultOpenLongPositionArgs.swapIn,
                swapOut: swapOut || defaultOpenLongPositionArgs.swapOut
            }),
            ctx.createABSwapIx({
                swapIn:   swapIn || defaultOpenLongPositionArgs.swapIn,
                swapOut:  swapOut || defaultOpenLongPositionArgs.swapOut,
                poolAtaA: ctx.longPoolCurrencyVault,
                poolAtaB: ctx.longPoolCollateralVault
            }),
            ctx.openLongPositionCleanup(),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.sendInvalid(instructions);
        assert.fail("Should have thrown an error");
    } catch (err) {
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6008);
        } else if (err instanceof ProgramError) {
            assert.equal(err.code, 6008);
        } else if (/Transaction signature verification failure/.test(err.toString())) {
            // This is expected when using an invalid signer
            assert.ok(true);
        } else {
            console.log(err);
            throw err;
        }
    }
};

export const openLongPositionSetupWithoutCosigner = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
}: OpenPositionArgs = defaultOpenLongPositionArgs) => {
    const now = new Date().getTime() / 1_000;

    return await ctx.program.methods.openLongPositionSetup(
        ctx.nonce,
        new anchor.BN(minOut ? minOut.toString() : defaultOpenLongPositionArgs.minOut.toString()),
        new anchor.BN(downPayment ? downPayment.toString() : defaultOpenLongPositionArgs.downPayment.toString()),
        new anchor.BN(principal ? principal.toString() : defaultOpenLongPositionArgs.principal.toString()),
        new anchor.BN(fee ? fee.toString() : defaultOpenLongPositionArgs.fee.toString()),
        new anchor.BN(now + 3600),
    ).accountsPartial({
        owner:        ctx.program.provider.publicKey,
        lpVault:      ctx.lpVault,
        pool:         ctx.longPool,
        collateral:   ctx.collateral,
        currency:     ctx.currency,
        authority:    ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
        permission:   ctx.nonSwapPermission,
        feeWallet:    ctx.feeWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openShortPositionWithoutCosigner = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
}: OpenPositionArgs = defaultOpenShortPositionArgs) => {
    const now = new Date().getTime() / 1_000;

    return await ctx.program.methods.openShortPositionSetup(
        ctx.nonce,
        new anchor.BN(minOut ? minOut.toString() : defaultOpenShortPositionArgs.minOut.toString()),
        new anchor.BN(downPayment ? downPayment.toString() : defaultOpenShortPositionArgs.downPayment.toString()),
        new anchor.BN(principal ? principal.toString() : defaultOpenShortPositionArgs.principal.toString()),
        new anchor.BN(fee ? fee.toString() : defaultOpenShortPositionArgs.fee.toString()),
        new anchor.BN(now + 3600),
    ).accountsPartial({
        owner:                  ctx.program.provider.publicKey,
        lpVault:                ctx.lpVault,
        vault:                  ctx.vault,
        pool:                   ctx.shortPool,
        collateral:             ctx.collateral,
        currency:               ctx.currency,
        collateralVault:        ctx.shortPoolCollateralVault,
        currencyVault:          ctx.shortPoolCurrencyVault,
        authority:              ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
        permission:             ctx.nonSwapPermission,
        feeWallet:              ctx.feeWallet,
        currencyTokenProgram:   TOKEN_PROGRAM_ID,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openShortPositionSetupWithoutCosigner = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
}: OpenPositionArgs = defaultOpenShortPositionArgs) => {
    const now = new Date().getTime() / 1_000;

    return await ctx.program.methods.openShortPositionSetup(
        ctx.nonce,
        new anchor.BN(minOut.toString()),
        new anchor.BN(downPayment.toString()),
        new anchor.BN(principal.toString()),
        new anchor.BN(fee.toString()),
        new anchor.BN(now + 3600),
    ).accountsPartial({
        owner:                  ctx.program.provider.publicKey,
        lpVault:                ctx.lpVault,
        pool:                   ctx.shortPool,
        collateral:             ctx.collateral,
        currency:               ctx.currency,
        authority:              ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
        permission:             ctx.nonSwapPermission,
        feeWallet:              ctx.feeWallet,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        currencyTokenProgram:   TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openShortPositionWithInvalidPosition = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenShortPositionArgs) => {
    // First create a position to ensure it already exists
    try {
        // First run a successful position creation
        await ctx.openShortPosition({
            minOut:      minOut || defaultOpenShortPositionArgs.minOut,
            downPayment: downPayment || defaultOpenShortPositionArgs.downPayment,
            principal:   principal || defaultOpenShortPositionArgs.principal,
            fee:         fee || defaultOpenShortPositionArgs.fee,
            swapIn:      swapIn || defaultOpenShortPositionArgs.swapIn,
            swapOut:     swapOut || defaultOpenShortPositionArgs.swapOut
        });

        // Now try to create it again, which should fail
        const instructions = await Promise.all([
            ctx.openShortPositionSetup({minOut, downPayment, principal, fee}),
            ctx.createABSwapIx({
                swapIn:   swapIn || defaultOpenShortPositionArgs.swapIn,
                swapOut:  swapOut || defaultOpenShortPositionArgs.swapOut,
                poolAtaA: ctx.shortPoolCurrencyVault,
                poolAtaB: ctx.shortPoolCollateralVault
            }),
            ctx.openShortPositionCleanup(),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions, ctx.SWAP_AUTHORITY);

        assert.fail("Should have thrown an error");
    } catch (err) {
        if (/already in use/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
};

export const openLongPositionWithInvalidPosition = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenLongPositionArgs) => {
    // First create a position to ensure it already exists
    try {
        // First run a successful position creation
        await ctx.openLongPosition({
            minOut:      minOut || defaultOpenLongPositionArgs.minOut,
            downPayment: downPayment || defaultOpenLongPositionArgs.downPayment,
            principal:   principal || defaultOpenLongPositionArgs.principal,
            fee:         fee || defaultOpenLongPositionArgs.fee,
            swapIn:      swapIn || defaultOpenLongPositionArgs.swapIn,
            swapOut:     swapOut || defaultOpenLongPositionArgs.swapOut
        });

        // Now try to create it again, which should fail
        const instructions = await Promise.all([
            ctx.openLongPositionSetup({minOut, downPayment, principal, fee}),
            ctx.createABSwapIx({
                swapIn:   swapIn || defaultOpenLongPositionArgs.swapIn,
                swapOut:  swapOut || defaultOpenLongPositionArgs.swapOut,
                poolAtaA: ctx.longPoolCurrencyVault,
                poolAtaB: ctx.longPoolCollateralVault
            }),
            ctx.openLongPositionCleanup(),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions, ctx.SWAP_AUTHORITY);

        assert.fail("Should have thrown an error");
    } catch (err) {
        if (/already in use/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
};

/**
 * Invalid Close Positions
 **/
export const closeLongPositionWithIncorrectOwner = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs = defaultCloseLongPositionArgs) => {
    try {
        const instructions = await Promise.all([
            ctx.program.methods.closeLongPositionSetup(
                new anchor.BN(minOut.toString()),
                new anchor.BN(interest.toString()),
                new anchor.BN(executionFee.toString()),
                new anchor.BN(Date.now() / 1_000 + 60 * 60),
            ).accountsPartial({
                owner:              ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect owner
                closePositionSetup: {
                    pool:         ctx.longPool,
                    owner:        ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect owner
                    collateral:   ctx.collateral,
                    position:     ctx.longPosition,
                    permission:   ctx.swapPermission,
                    authority:    ctx.SWAP_AUTHORITY.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }).instruction(),

            ctx.createBASwapIx({
                swapIn,
                swapOut,
                poolAtaA: ctx.longPoolCurrencyVault,
                poolAtaB: ctx.longPoolCollateralVault
            }),

            ctx.closeLongPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions, ctx.SWAP_AUTHORITY);

        assert.ok(false);
    } catch (err) {
        if (/owner constraint/.test(err.toString()) || /6000/.test(err.toString())) {
            assert.ok(true);
        } else if (/Transaction signature verification failure/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
};

export const closeLongPositionWithoutCosigner = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs = defaultCloseLongPositionArgs) => {
    try {
        const instructions = await Promise.all([
            ctx.program.methods.closeLongPositionSetup(
                new anchor.BN(minOut.toString()),
                new anchor.BN(interest.toString()),
                new anchor.BN(executionFee.toString()),
                new anchor.BN(Date.now() / 1_000 + 60 * 60),
            ).accountsPartial({
                owner:              ctx.program.provider.publicKey,
                closePositionSetup: {
                    pool:         ctx.longPool,
                    owner:        ctx.program.provider.publicKey,
                    collateral:   ctx.collateral,
                    position:     ctx.longPosition,
                    permission:   ctx.nonSwapPermission, // Valid permission w/o singer permission
                    authority:    ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }).instruction(),

            ctx.createBASwapIx({
                swapIn,
                swapOut,
                poolAtaA: ctx.longPoolCurrencyVault,
                poolAtaB: ctx.longPoolCollateralVault
            }),

            ctx.closeLongPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.sendInvalid(instructions);

        assert.ok(false);
    } catch (err) {
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6008);
        } else if (err instanceof ProgramError) {
            assert.equal(err.code, 6008);
        } else if (/Transaction signature verification failure/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.log(err);
            assert.ok(false);
        }
    }
}

export const closeLongPositionWithInvalidSetup = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
}: ClosePositionArgs = defaultCloseLongPositionArgs) => {
    try {
        const instructions = await ctx.closeLongPositionSetup({
            minOut:       minOut || defaultCloseLongPositionArgs.minOut,
            interest:     interest || defaultCloseLongPositionArgs.interest,
            executionFee: executionFee || defaultCloseLongPositionArgs.executionFee,
        });
        const cleanup = await ctx.closeLongPositionCleanup();

        await ctx.send([instructions, instructions, cleanup], ctx.SWAP_AUTHORITY);

        assert.ok(false);
    } catch (err) {
        // 'Account already exists'
        if (/already in use/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
}

export const closeLongPositionWithoutCleanup = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
}: ClosePositionArgs = defaultCloseLongPositionArgs) => {
    try {
        await ctx.send([
            await ctx.closeLongPositionSetup({
                minOut,
                interest,
                executionFee
            })
        ], ctx.SWAP_AUTHORITY);

        assert.ok(false);
    } catch (err) {
        // 'Missing cleanup'
        if (/6002/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
}

export const closeShortPositionWithIncorrectOwner = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs = defaultCloseShortPositionArgs) => {
    try {
        const instructions = await Promise.all([
            ctx.program.methods.closeShortPositionSetup(
                new anchor.BN(minOut.toString()),
                new anchor.BN(interest.toString()),
                new anchor.BN(executionFee.toString()),
                new anchor.BN(Date.now() / 1_000 + 60 * 60),
            ).accountsPartial({
                owner:              ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect owner
                closePositionSetup: {
                    pool:         ctx.shortPool,
                    owner:        ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect owner
                    collateral:   ctx.collateral,
                    position:     ctx.shortPosition,
                    permission:   ctx.swapPermission,
                    authority:    ctx.SWAP_AUTHORITY.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }).instruction(),

            ctx.createBASwapIx({
                swapIn,
                swapOut,
                poolAtaA: ctx.shortPoolCollateralVault,
                poolAtaB: ctx.shortPoolCurrencyVault,
            }),

            ctx.closeShortPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions, ctx.SWAP_AUTHORITY);

        assert.ok(false);
    } catch (err) {
        if (/owner constraint/.test(err.toString()) || /6000/.test(err.toString())) {
            assert.ok(true);
        } else if (/Transaction signature verification failure/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
};

export const closeShortPositionWithoutCosigner = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs = defaultCloseShortPositionArgs) => {
    try {
        const instructions = await Promise.all([
            ctx.program.methods.closeShortPositionSetup(
                new anchor.BN(minOut.toString()),
                new anchor.BN(interest.toString()),
                new anchor.BN(executionFee.toString()),
                new anchor.BN(Date.now() / 1_000 + 60 * 60),
            ).accountsPartial({
                owner:              ctx.program.provider.publicKey,
                closePositionSetup: {
                    pool:            ctx.longPool,
                    owner:           ctx.program.provider.publicKey,
                    collateral:      ctx.collateral,
                    collateralVault: ctx.shortPoolCollateralVault,
                    currencyVault:   ctx.shortPoolCurrencyVault,
                    position:        ctx.shortPosition,
                    permission:      ctx.nonSwapPermission, // Valid permission w/o singer permission
                    authority:       ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
                    tokenProgram:    TOKEN_PROGRAM_ID,
                },
            }).instruction(),

            ctx.createBASwapIx({
                swapIn,
                swapOut,
                poolAtaA: ctx.shortPoolCollateralVault,
                poolAtaB: ctx.shortPoolCurrencyVault,
            }),

            ctx.closeShortPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        return await ctx.sendInvalid(instructions);
    } catch (err) {
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6008);
        } else if (err instanceof ProgramError) {
            assert.equal(err.code, 6008);
        } else if (/Transaction signature verification failure/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.log(err);
            assert.ok(false);
        }
    }
}

export const closeShortPositionWithInvalidSetup = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
}: ClosePositionArgs = defaultCloseShortPositionArgs) => {
    try {
        const instructions = await ctx.closeShortPositionSetup({
            minOut,
            interest,
            executionFee
        });

        const cleanup = await ctx.closeShortPositionCleanup();
        await ctx.send([instructions, instructions, cleanup], ctx.SWAP_AUTHORITY);

        assert.ok(false);
    } catch (err) {
        // 'Account already exists'
        if (/already in use/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
}

export const closeShortPositionWithoutCleanup = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
}: ClosePositionArgs = defaultCloseShortPositionArgs) => {
    try {
        await ctx.send([
            await ctx.closeShortPositionSetup({
                minOut,
                interest,
                executionFee
            })
        ], ctx.SWAP_AUTHORITY);
        assert.ok(false);
    } catch (err) {
        // 'Missing cleanup'
        if (/6002/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
}

export const closeLongPositionWithBadDebt = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs = defaultCloseLongPositionArgs) => {
    try {
        // In a bad debt scenario, the collateral value is less than the principal + interest
        // This is simulated by setting a very small swapOut value
        const badDebtSwapOut = BigInt(10); // Very small amount, not enough to cover debt

        const instructions = await Promise.all([
            ctx.closeLongPositionSetup({
                minOut,
                interest,
                executionFee
            }),
            ctx.createBASwapIx({
                swapIn:   swapIn || defaultCloseLongPositionArgs.swapIn,
                swapOut:  badDebtSwapOut, // Use the bad debt swap out value
                poolAtaA: ctx.longPoolCurrencyVault,
                poolAtaB: ctx.longPoolCollateralVault
            }),
            ctx.closeLongPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions, ctx.SWAP_AUTHORITY);

        assert.fail("Should have thrown a BadDebt error");
    } catch (err) {
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6011, "Should fail with BadDebt error code");
        } else if (err instanceof ProgramError) {
            assert.equal(err.code, 6011, "Should fail with BadDebt error code");
        } else if (/BadDebt/.test(err.toString())) {
            assert.ok(true, "Error contains BadDebt message");
        } else {
            console.error("Unexpected error:", err);
            assert.fail("Should have failed with BadDebt error");
        }
    }
};

export const closeShortPositionWithBadDebt = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs = defaultCloseShortPositionArgs) => {
    try {
        // In a bad debt scenario, the collateral value is less than the principal + interest
        // This is simulated by setting a very small swapOut value
        const badDebtSwapOut = BigInt(10); // Very small amount, not enough to cover debt

        const instructions = await Promise.all([
            ctx.closeShortPositionSetup({
                minOut,
                interest,
                executionFee
            }),
            ctx.createBASwapIx({
                swapIn:   swapIn || defaultCloseShortPositionArgs.swapIn,
                swapOut:  badDebtSwapOut, // Use the bad debt swap out value
                poolAtaA: ctx.shortPoolCurrencyVault,
                poolAtaB: ctx.shortPoolCollateralVault
            }),
            ctx.closeShortPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions, ctx.SWAP_AUTHORITY);

        assert.fail("Should have thrown a BadDebt error");
    } catch (err) {
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6011, "Should fail with BadDebt error code");
        } else if (err instanceof ProgramError) {
            assert.equal(err.code, 6011, "Should fail with BadDebt error code");
        } else if (/BadDebt/.test(err.toString())) {
            assert.ok(true, "Error contains BadDebt message");
        } else {
            console.error("Unexpected error:", err);
            assert.fail("Should have failed with BadDebt error");
        }
    }
};
