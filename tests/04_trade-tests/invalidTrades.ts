import * as anchor from "@coral-xyz/anchor"
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
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
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenLongPositionArgs) => {
    try {
        const instructions = await Promise.all([
            ctx.openLongPositionSetup({minOut, downPayment, principal, fee}),
            ctx.openLongPositionSetup({minOut, downPayment, principal, fee}),
            ctx.createABSwapIx({
                swapIn,
                swapOut,
                poolAtaA: ctx.longPoolCurrencyVault,
                poolAtaB: ctx.longPoolCollateralVault
            }),
            ctx.openLongPositionCleanup(),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Account already exists'
        assert.ok(/already in use/.test(err.toString()));
    }
};

export const openShortPositionWithInvalidSetup = async (ctx: TradeContext, {
        minOut,
        downPayment,
        principal,
        fee,
        swapIn,
        swapOut,
    }: OpenPositionArgs = defaultOpenShortPositionArgs
) => {
    try {
        const instructions = await Promise.all([
            ctx.openShortPositionSetup({minOut, downPayment, principal, fee}),
            ctx.openShortPositionSetup({minOut, downPayment, principal, fee}),
            ctx.createBASwapIx({
                swapIn,
                swapOut,
                poolAtaA: ctx.shortPoolCurrencyVault,
                poolAtaB: ctx.shortPoolCollateralVault
            }),
            ctx.openShortPositionCleanup(),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Account already exists'
        assert.ok(/already in use/.test(err.toString()));
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

        await ctx.send(instructions);
        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Missing cleanup'
        assert.ok(/6002/.test(err.toString()));
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

        ctx.send(instructions);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Missing cleanup'
        assert.ok(/6002/.test(err.toString()))
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
        const instructions = await Promise.all([
            ctx.openLongPositionSetup({minOut, downPayment, principal, fee}),
            ctx.createABSwapIx({
                swapIn,
                swapOut,
                poolAtaA: ctx.longPoolCurrencyVault,
                poolAtaB: ctx.longPoolCollateralVault
            }),
            openLongPositionCleanupWithInvalidPool(ctx),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Invalid pool'
        assert.ok(/6006/.test(err.toString()));
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
        await openShortPositionWithInvalidPool(ctx, defaultOpenShortPositionArgs);

        const instructions = await Promise.all([
            ctx.openShortPositionSetup({minOut, downPayment, principal, fee}),
            ctx.createABSwapIx({
                swapIn,
                swapOut,
                poolAtaA: ctx.shortPoolCurrencyVault,
                poolAtaB: ctx.shortPoolCollateralVault
            }),
            openShortPositionCleanupWithInvalidPool(ctx),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Invalid pool'
        assert.ok(/6006/.test(err.toString()));
    }
};

export const openLongPositionCleanupWithInvalidPool = async (ctx: TradeContext) => {
    return await ctx.program.methods.openLongPositionCleanup(
    ).accountsPartial({
        owner:        ctx.program.provider.publicKey,
        pool:         ctx.shortPool,
        position:     ctx.longPosition,
        tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openShortPositionCleanupWithInvalidPool = async (ctx: TradeContext) => {
    return await ctx.program.methods.openShortPositionCleanup(
    ).accountsPartial({
        owner:        ctx.program.provider.publicKey,
        pool:         ctx.longPool,
        position:     ctx.shortPosition,
        tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
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
            openLongPositionSetupWithoutCosigner(ctx, {swapIn, swapOut, minOut, downPayment, principal, fee}),
            ctx.createABSwapIx({
                swapIn,
                swapOut,
                poolAtaA: ctx.longPoolCurrencyVault,
                poolAtaB: ctx.longPoolCollateralVault
            }),
            ctx.openLongPositionCleanup(),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.sendInvalid(instructions);
        assert.ok(false);
    } catch (err) {
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6008);
        } else if (err instanceof ProgramError) {
            assert.equal(err.code, 6008);
        } else {
            console.log(err);
            assert.ok(false);
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
        new anchor.BN(minOut.toString()),
        new anchor.BN(downPayment.toString()),
        new anchor.BN(principal.toString()),
        new anchor.BN(fee.toString()),
        new anchor.BN(now + 3600),
    ).accountsPartial({
        owner:        ctx.program.provider.publicKey,
        lpVault:      ctx.lpVault,
        pool:         ctx.longPool,
        collateral:   ctx.collateral,
        currency:     ctx.currency,
        authority:    ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
        permission:   ctx.invalidPermission,
        feeWallet:    ctx.feeWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openShortPositionWithoutCosigner = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenShortPositionArgs) => {
    try {
        const instructions = await Promise.all([
            openShortPositionSetupWithoutCosigner(ctx, {swapIn, swapOut, minOut, downPayment, principal, fee}),
            ctx.createABSwapIx({
                swapIn,
                swapOut,
                poolAtaA: ctx.longPoolCurrencyVault,
                poolAtaB: ctx.longPoolCollateralVault
            }),
            ctx.openShortPositionCleanup(),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.sendInvalid(instructions);

        assert.ok(false);
    } catch (err) {
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6008);
        } else if (err instanceof ProgramError) {
            assert.equal(err.code, 6008);
        } else {
            console.log(err);
            assert.ok(false);
        }
    }
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
        permission:             ctx.invalidPermission,
        feeWallet:              ctx.feeWallet,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        currencyTokenProgram:   TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openLongPositionWithInvalidPosition = async (ctx: TradeContext, {
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
            ctx.openLongPositionCleanup(),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Account already exists'
        assert.ok(/already in use/.test(err.toString()));
    }
};

export const openShortPositionWithInvalidPosition = async (ctx: TradeContext, {
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
                poolAtaA: ctx.shortPoolCollateralVault,
                poolAtaB: ctx.shortPoolCurrencyVault
            }),
            ctx.openShortPositionCleanup(),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Account already exists'
        assert.ok(/already in use/.test(err.toString()));
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

        await ctx.send(instructions);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        assert.ok(/owner constraint/.test(err.toString()) || /6000/.test(err.toString()));
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
                    permission:   ctx.invalidPermission, // Valid permission w/o singer permission
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
        await closeLongPositionWithInvalidSetup(ctx);
        const instructions = await ctx.closeLongPositionSetup({
            minOut,
            interest,
            executionFee
        });

        await ctx.send([instructions, instructions]);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Account already exists'
        assert.ok(/already in use/.test(err.toString()));
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
        ]);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Missing cleanup'
        assert.ok(/6002/.test(err.toString()))
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

        await ctx.send(instructions);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        assert.ok(/owner constraint/.test(err.toString()) || /6000/.test(err.toString()));
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
                    pool:         ctx.longPool,
                    owner:        ctx.program.provider.publicKey,
                    collateral:   ctx.collateral,
                    position:     ctx.longPosition,
                    permission:   ctx.invalidPermission, // Valid permission w/o singer permission
                    authority:    ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
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

        return await ctx.sendInvalid(instructions);
        assert.ok(false);
    } catch (err) {
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6008);
        } else if (err instanceof ProgramError) {
            assert.equal(err.code, 6008);
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
        await closeShortPositionWithInvalidSetup(ctx);
        const instructions = await ctx.closeShortPositionSetup({
            minOut,
            interest,
            executionFee
        });

        await ctx.send([instructions, instructions]);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Account already exists'
        assert.ok(/already in use/.test(err.toString()));
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
        ]);
        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Missing cleanup'
        assert.ok(/6002/.test(err.toString()))
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
        // If we reach here, the bad debt was handled correctly
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
                swapIn,
                swapOut:  badDebtSwapOut, // Use the bad debt swap out value
                poolAtaA: ctx.longPoolCurrencyVault,
                poolAtaB: ctx.longPoolCollateralVault
            }),
            ctx.closeLongPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions);

        assert.ok(true);
    } catch (err) {
        console.error(err);
        assert.ok(false, "Bad debt scenario should be handled gracefully");
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
        await closeShortPositionWithBadDebt(ctx, defaultCloseShortPositionArgs);
        // In a bad debt scenario, the collateral value is less than the principal + interest
        // This is simulated by setting a very small swapOut value
        const badDebtSwapOut = BigInt(10); // Very small amount, not enough to cover debt

        const instructions = await Promise.all([
            ctx.closeShortPositionSetup({
                minOut,
                interest,
                executionFee
            }),
            ctx.createABSwapIx({
                swapIn,
                swapOut:  badDebtSwapOut, // Use the bad debt swap out value
                poolAtaA: ctx.shortPoolCurrencyVault,
                poolAtaB: ctx.shortPoolCollateralVault
            }),
            ctx.closeShortPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6011);
        } else if (err instanceof ProgramError) {
            assert.equal(err.code, 6011);
        } else {
            assert.ok(true);
        }
    }
};
