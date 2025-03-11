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
}: OpenPositionArgs) => {
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

    return await ctx.send(instructions);
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

    return await ctx.send(instructions);
};

export const openLongPositionWithoutCleanup = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenLongPositionArgs) => {
    const instructions = await Promise.all([
        ctx.openLongPositionSetup({minOut, downPayment, principal, fee}),
        ctx.createABSwapIx({
            swapIn,
            swapOut,
            poolAtaA: ctx.longPoolCurrencyVault,
            poolAtaB: ctx.longPoolCollateralVault
        }),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return ctx.send(instructions);
};

export const openShortPositionWithoutCleanup = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenShortPositionArgs) => {
    const instructions = await Promise.all([
        ctx.openShortPositionSetup({minOut, downPayment, principal, fee}),
        ctx.createABSwapIx({
            swapIn,
            swapOut,
            poolAtaA: ctx.shortPoolCurrencyVault,
            poolAtaB: ctx.shortPoolCollateralVault
        }),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return ctx.send(instructions);
};


export const openLongPositionWithInvalidPool = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs) => {
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

    return ctx.send(instructions);
};

export const openShortPositionWithInvalidPool = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenShortPositionArgs) => {
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

    return ctx.send(instructions);
};

export const openLongPositionCleanupWithInvalidPool = async (ctx: TradeContext) => {
    return await ctx.program.methods.openLongPositionCleanup(
    ).accountsPartial({
        owner: ctx.program.provider.publicKey,
        pool: ctx.shortPool,
        position: ctx.longPosition,
        tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openShortPositionCleanupWithInvalidPool = async (ctx: TradeContext) => {
    return await ctx.program.methods.openShortPositionCleanup(
    ).accountsPartial({
        owner: ctx.program.provider.publicKey,
        pool: ctx.longPool,
        position: ctx.shortPosition,
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

    return ctx.sendInvalid(instructions);
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
        owner: ctx.program.provider.publicKey,
        lpVault: ctx.lpVault,
        pool: ctx.longPool,
        collateral: ctx.collateral,
        currency: ctx.currency,
        authority: ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
        permission: ctx.invalidPermission,
        feeWallet: ctx.feeWallet,
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

    return ctx.sendInvalid(instructions);
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
        owner: ctx.program.provider.publicKey,
        lpVault: ctx.lpVault,
        pool: ctx.shortPool,
        collateral: ctx.collateral,
        currency: ctx.currency,
        authority: ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
        permission: ctx.invalidPermission,
        feeWallet: ctx.feeWallet,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        currencyTokenProgram: TOKEN_PROGRAM_ID,
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
};

export const openShortPositionWithInvalidPosition = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenShortPositionArgs) => {
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
    const instructions = await Promise.all([
        ctx.program.methods.closeLongPositionSetup(
            new anchor.BN(minOut.toString()),
            new anchor.BN(interest.toString()),
            new anchor.BN(executionFee.toString()),
            new anchor.BN(Date.now() / 1_000 + 60 * 60),
        ).accountsPartial({
            owner: ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect owner
            closePositionSetup: {
                pool: ctx.longPool,
                owner: ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect owner
                collateral: ctx.collateral,
                position: ctx.longPosition,
                permission: ctx.swapPermission,
                authority: ctx.SWAP_AUTHORITY.publicKey,
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

    return await ctx.send(instructions);
};

export const closeLongPositionWithoutCosigner = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs = defaultCloseLongPositionArgs) => {
    const instructions = await Promise.all([
        ctx.program.methods.closeLongPositionSetup(
            new anchor.BN(minOut.toString()),
            new anchor.BN(interest.toString()),
            new anchor.BN(executionFee.toString()),
            new anchor.BN(Date.now() / 1_000 + 60 * 60),
        ).accountsPartial({
            owner: ctx.program.provider.publicKey,
            closePositionSetup: {
                pool: ctx.longPool,
                owner: ctx.program.provider.publicKey,
                collateral: ctx.collateral,
                position: ctx.longPosition,
                permission: ctx.invalidPermission, // Valid permission w/o singer permission
                authority: ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
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

    return await ctx.sendInvalid(instructions);
}

export const closeLongPositionWithInvalidSetup = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
}: ClosePositionArgs = defaultCloseLongPositionArgs) => {

    const instructions = await ctx.closeLongPositionSetup({
        minOut,
        interest,
        executionFee
    });

    return await ctx.send([instructions, instructions]);
}

export const closeLongPositionWithoutCleanup = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
}: ClosePositionArgs = defaultCloseLongPositionArgs) => {
    return await ctx.send([await ctx.closeLongPositionSetup({
        minOut,
        interest,
        executionFee
    })]);
}

export const closeShortPositionWithIncorrectOwner = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs = defaultCloseShortPositionArgs) => {
    const instructions = await Promise.all([
        ctx.program.methods.closeShortPositionSetup(
            new anchor.BN(minOut.toString()),
            new anchor.BN(interest.toString()),
            new anchor.BN(executionFee.toString()),
            new anchor.BN(Date.now() / 1_000 + 60 * 60),
        ).accountsPartial({
            owner: ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect owner
            closePositionSetup: {
                pool: ctx.shortPool,
                owner: ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect owner
                collateral: ctx.collateral,
                position: ctx.shortPosition,
                permission: ctx.swapPermission,
                authority: ctx.SWAP_AUTHORITY.publicKey,
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

    return await ctx.send(instructions);
};

export const closeShortPositionWithoutCosigner = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs = defaultCloseShortPositionArgs) => {
    const instructions = await Promise.all([
        ctx.program.methods.closeShortPositionSetup(
            new anchor.BN(minOut.toString()),
            new anchor.BN(interest.toString()),
            new anchor.BN(executionFee.toString()),
            new anchor.BN(Date.now() / 1_000 + 60 * 60),
        ).accountsPartial({
            owner: ctx.program.provider.publicKey,
            closePositionSetup: {
                pool: ctx.longPool,
                owner: ctx.program.provider.publicKey,
                collateral: ctx.collateral,
                position: ctx.longPosition,
                permission: ctx.invalidPermission, // Valid permission w/o singer permission
                authority: ctx.NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
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
}

export const closeShortPositionWithInvalidSetup = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
}: ClosePositionArgs = defaultCloseShortPositionArgs) => {
    const instructions = await ctx.closeShortPositionSetup({
        minOut,
        interest,
        executionFee
    });

    return await ctx.send([instructions, instructions]);
}

export const closeShortPositionWithoutCleanup = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
}: ClosePositionArgs = defaultCloseShortPositionArgs) => {
    return await ctx.send([await ctx.closeShortPositionSetup({
        minOut,
        interest,
        executionFee
    })]);
}

export const openLongPositionWithoutCosigner = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenLongPositionArgs) => {
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

    return ctx.sendInvalid(instructions);
};
