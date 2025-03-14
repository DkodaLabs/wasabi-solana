import * as anchor from '@coral-xyz/anchor';
import { TransactionInstruction } from "@solana/web3.js";
import { assert } from "chai";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
    LiquidationArgs,
    LiquidationContext,
    defaultLiquidateLongPositionArgs,
    defaultLiquidateShortPositionArgs
} from "./liquidationContext";

export const liquidateLongPositionWithInvalidPermission = async (ctx: LiquidationContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: LiquidationArgs = defaultLiquidateLongPositionArgs) => {
    const instructions = await Promise.all([
        ctx.program.methods
            .liquidatePositionSetup(
                new anchor.BN(minOut.toString()),
                new anchor.BN(interest.toString()),
                new anchor.BN(executionFee.toString()),
                new anchor.BN(Date.now() / 1_000 + 60 * 60)
            ).accountsPartial({
                closePositionSetup: {
                    owner: ctx.program.provider.publicKey,
                    position: ctx.longPosition,
                    pool: ctx.longPool,
                    collateral: ctx.collateral,
                    authority: ctx.NON_SWAP_AUTHORITY.publicKey,
                    permission: ctx.nonSwapPermission, // Permission without liquidation rights
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }).instruction(),

        ctx.createBASwapIx({
            swapIn,
            swapOut,
            poolAtaA: ctx.longPoolCurrencyVault,
            poolAtaB: ctx.longPoolCollateralVault,
            authority: ctx.NON_SWAP_AUTHORITY.publicKey
        }),

        ctx.liquidateLongPositionCleanup(ctx.NON_SWAP_AUTHORITY.publicKey)
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    try {
        await ctx.send(instructions, ctx.NON_SWAP_AUTHORITY);
        assert.fail("Should have failed with invalid permissions");
    } catch (err) {
        if (/6000/.test(err.toString()) || /InvalidPermissions/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            throw err;
        }
    }
}

export const liquidateShortPositionWithInvalidPermission = async (ctx: LiquidationContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: LiquidationArgs = defaultLiquidateShortPositionArgs) => {
    const instructions = await Promise.all([
        ctx.program.methods
            .liquidatePositionSetup(
                new anchor.BN(minOut.toString()),
                new anchor.BN(interest.toString()),
                new anchor.BN(executionFee.toString()),
                new anchor.BN(Date.now() / 1_000 + 60 * 60)
            ).accountsPartial({
                closePositionSetup: {
                    owner: ctx.program.provider.publicKey,
                    position: ctx.shortPosition,
                    pool: ctx.shortPool,
                    collateral: ctx.collateral,
                    authority: ctx.NON_SWAP_AUTHORITY.publicKey,
                    permission: ctx.nonSwapPermission, // Permission without liquidation rights
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }).instruction(),
        ctx.createBASwapIx({
            swapIn,
            swapOut,
            poolAtaA: ctx.shortPoolCurrencyVault,
            poolAtaB: ctx.shortPoolCollateralVault,
            authority: ctx.NON_SWAP_AUTHORITY.publicKey
        }),
        ctx.liquidateShortPositionCleanup(ctx.NON_SWAP_AUTHORITY.publicKey)
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    try {
        await ctx.send(instructions, ctx.NON_SWAP_AUTHORITY);
        assert.fail("Should have failed with invalid permissions");
    } catch (err) {
        if (/6000/.test(err.toString()) || /InvalidPermissions/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            throw err;
        }
    }
}

export const liquidateLongPositionWithoutExceedingThreshold = async (ctx: LiquidationContext, {
    minOut,
    interest,
    executionFee,
}: LiquidationArgs = defaultLiquidateLongPositionArgs) => {
    const swapIn = BigInt(1900);
    const swapOut = BigInt(2000);

    const instructions = await Promise.all([
        ctx.liquidateLongPositionSetup({ minOut, interest, executionFee }),
        ctx.createBASwapIx({
            swapIn: swapIn,
            swapOut: swapOut,
            poolAtaA: ctx.longPoolCurrencyVault,
            poolAtaB: ctx.longPoolCollateralVault,
            authority: ctx.SWAP_AUTHORITY.publicKey
        }),
        ctx.liquidateLongPositionCleanup()
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    try {
        await ctx.send(instructions, ctx.SWAP_AUTHORITY);
        assert.fail("Should have failed with liquidation threshold not exceeded");
    } catch (err) {
        if (/6026/.test(err.toString()) || /LiquidationThresholdNotReached/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            throw err;
        }
    }
}

export const liquidateShortPositionWithoutExceedingThreshold = async (ctx: LiquidationContext, {
    minOut,
    interest,
    executionFee,
}: LiquidationArgs = defaultLiquidateShortPositionArgs) => {
    // Use a small swap amount that won't exceed the liquidation threshold
    const swapIn = BigInt(100);
    const swapOut = BigInt(200);

    const instructions = await Promise.all([
        ctx.liquidateShortPositionSetup({ minOut, interest, executionFee }),
        ctx.createBASwapIx({
            swapIn:    swapIn,
            swapOut:   swapOut,
            poolAtaA:  ctx.shortPoolCurrencyVault,
            poolAtaB:  ctx.shortPoolCollateralVault,
            authority: ctx.SWAP_AUTHORITY.publicKey
        }),
        ctx.liquidateShortPositionCleanup()
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    try {
        await ctx.send(instructions, ctx.SWAP_AUTHORITY);
        assert.fail("Should have failed with liquidation threshold not exceeded");
    } catch (err) {
        if (/6026/.test(err.toString()) || /LiquidationThresholdNotReached/.test(err.toString())) {
            assert.ok(true);
        } else {
            console.error(err);
            throw err;
        }
    }
}
