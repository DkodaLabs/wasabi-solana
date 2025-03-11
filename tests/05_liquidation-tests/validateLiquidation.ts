import { assert } from "chai";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getMultipleTokenAccounts } from "../utils";
import { LiquidationContext, LiquidationArgs } from "./liquidationContext";
import { defaultLiquidateLongPositionArgs, defaultLiquidateShortPositionArgs } from "./liquidationContext";
import * as anchor from '@coral-xyz/anchor';
import { TransactionInstruction } from "@solana/web3.js";

export const validateLiquidateLongPosition = async (ctx: LiquidationContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: LiquidationArgs = defaultLiquidateLongPositionArgs) => {
    // Get position before liquidation
    const positionBefore = await ctx.program.account.position.fetch(ctx.longPosition);
    
    // Get token account balances before liquidation
    const [vaultBefore, liquidationWalletBefore, feeWalletBefore] = await getMultipleTokenAccounts(
        ctx.program.provider.connection, 
        [
            ctx.vault,
            ctx.liquidationWallet,
            ctx.feeWallet,
        ], 
        TOKEN_PROGRAM_ID
    );
    
    // Liquidate the position
    await ctx.liquidateLongPosition({minOut, interest, executionFee, swapIn, swapOut});
    
    // Verify position is closed
    const positionAfter = await ctx.program.account.position.fetchNullable(ctx.longPosition);
    assert.isNull(positionAfter, "Position should be closed after liquidation");
    
    // Get token account balances after liquidation
    const [vaultAfter, liquidationWalletAfter, feeWalletAfter] = await getMultipleTokenAccounts(
        ctx.program.provider.connection, 
        [
            ctx.vault,
            ctx.liquidationWallet,
            ctx.feeWallet,
        ], 
        TOKEN_PROGRAM_ID
    );
    
    // Verify LP vault received principal + interest
    const expectedLpVaultDiff = positionBefore.principal.add(new anchor.BN(interest.toString()));
    const vaultDiff = vaultAfter.amount - vaultBefore.amount;
    assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString(), "LP vault should receive principal + interest");
    
    // Verify liquidation wallet received liquidation fee
    const liquidationWalletDiff = liquidationWalletAfter.amount - liquidationWalletBefore.amount;
    assert.isTrue(liquidationWalletDiff > BigInt(0), "Liquidation wallet should receive liquidation fee");
    
    // Verify fee wallet received execution fee
    const feeWalletDiff = feeWalletAfter.amount - feeWalletBefore.amount;
    assert.equal(feeWalletDiff.toString(), executionFee.toString(), "Fee wallet should receive execution fee");
    
    // Verify event was emitted
    assert.ok(ctx.liquidationEvent, "Liquidation event should be emitted");
    assert.equal(
        ctx.liquidationEvent.id.toString(),
        ctx.longPosition.toString(),
        "Position ID in event should match"
    );
    assert.equal(
        ctx.liquidationEvent.trader.toString(),
        ctx.program.provider.publicKey.toString(),
        "Trader in event should match"
    );
    assert.equal(
        ctx.liquidationEvent.liquidator.toString(),
        ctx.LIQUIDATOR_AUTHORITY.publicKey.toString(),
        "Liquidator in event should match"
    );
}

export const validateLiquidateShortPosition = async (ctx: LiquidationContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: LiquidationArgs = defaultLiquidateShortPositionArgs) => {
    // Get position before liquidation
    const positionBefore = await ctx.program.account.position.fetch(ctx.shortPosition);
    
    // Get token account balances before liquidation
    const [vaultBefore, liquidationWalletBefore, feeWalletBefore] = await getMultipleTokenAccounts(
        ctx.program.provider.connection, 
        [
            ctx.vault,
            ctx.liquidationWallet,
            ctx.feeWallet,
        ], 
        TOKEN_PROGRAM_ID
    );
    
    // Liquidate the position
    await ctx.liquidateShortPosition({minOut, interest, executionFee, swapIn, swapOut});
    
    // Verify position is closed
    const positionAfter = await ctx.program.account.position.fetchNullable(ctx.shortPosition);
    assert.isNull(positionAfter, "Position should be closed after liquidation");
    
    // Get token account balances after liquidation
    const [vaultAfter, liquidationWalletAfter, feeWalletAfter] = await getMultipleTokenAccounts(
        ctx.program.provider.connection, 
        [
            ctx.vault,
            ctx.liquidationWallet,
            ctx.feeWallet,
        ], 
        TOKEN_PROGRAM_ID
    );
    
    // Verify LP vault received principal + interest
    const expectedLpVaultDiff = positionBefore.principal.add(new anchor.BN(interest.toString()));
    const vaultDiff = vaultAfter.amount - vaultBefore.amount;
    assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString(), "LP vault should receive principal + interest");
    
    // Verify liquidation wallet received liquidation fee
    const liquidationWalletDiff = liquidationWalletAfter.amount - liquidationWalletBefore.amount;
    assert.isTrue(liquidationWalletDiff > BigInt(0), "Liquidation wallet should receive liquidation fee");
    
    // Verify fee wallet received execution fee
    const feeWalletDiff = feeWalletAfter.amount - feeWalletBefore.amount;
    assert.equal(feeWalletDiff.toString(), executionFee.toString(), "Fee wallet should receive execution fee");
    
    // Verify event was emitted
    assert.ok(ctx.liquidationEvent, "Liquidation event should be emitted");
    assert.equal(
        ctx.liquidationEvent.id.toString(),
        ctx.shortPosition.toString(),
        "Position ID in event should match"
    );
    assert.equal(
        ctx.liquidationEvent.trader.toString(),
        ctx.program.provider.publicKey.toString(),
        "Trader in event should match"
    );
    assert.equal(
        ctx.liquidationEvent.liquidator.toString(),
        ctx.LIQUIDATOR_AUTHORITY.publicKey.toString(),
        "Liquidator in event should match"
    );
}

// Invalid liquidation functions
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
                    authority: ctx.NON_LIQUIDATOR_AUTHORITY.publicKey,
                    permission: ctx.nonLiquidatorPermission, // Permission without liquidation rights
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }).instruction(),
        ctx.createBASwapIx({
            swapIn,
            swapOut,
            poolAtaA: ctx.longPoolCurrencyVault,
            poolAtaB: ctx.longPoolCollateralVault
        }),
        ctx.liquidateLongPositionCleanup()
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    try {
        await ctx.send(instructions, ctx.NON_LIQUIDATOR_AUTHORITY);
        assert.fail("Should have failed with invalid permissions");
    } catch (err) {
        console.error(err);
        assert.ok(/6000/.test(err.toString()) || /InvalidPermissions/.test(err.toString()));
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
                    authority: ctx.NON_LIQUIDATOR_AUTHORITY.publicKey,
                    permission: ctx.nonLiquidatorPermission, // Permission without liquidation rights
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }).instruction(),
        ctx.createABSwapIx({
            swapIn,
            swapOut,
            poolAtaA: ctx.shortPoolCurrencyVault,
            poolAtaB: ctx.shortPoolCollateralVault
        }),
        ctx.liquidateShortPositionCleanup()
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    try {
        await ctx.send(instructions, ctx.NON_LIQUIDATOR_AUTHORITY);
        assert.fail("Should have failed with invalid permissions");
    } catch (err) {
        console.error(err);
        assert.ok(/6000/.test(err.toString()) || /InvalidPermissions/.test(err.toString()));
    }
}

export const liquidateLongPositionWithoutExceedingThreshold = async (ctx: LiquidationContext, {
    minOut,
    interest,
    executionFee,
}: LiquidationArgs = defaultLiquidateLongPositionArgs) => {
    // Use a small swap amount that won't exceed the liquidation threshold
    const smallSwapIn = BigInt(100);
    const smallSwapOut = BigInt(110);

    const instructions = await Promise.all([
        ctx.liquidateLongPositionSetup({ minOut, interest, executionFee }),
        ctx.createBASwapIx({
            swapIn: smallSwapIn,
            swapOut: smallSwapOut,
            poolAtaA: ctx.longPoolCurrencyVault,
            poolAtaB: ctx.longPoolCollateralVault
        }),
        ctx.liquidateLongPositionCleanup()
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    try {
        await ctx.send(instructions, ctx.LIQUIDATOR_AUTHORITY);
        assert.fail("Should have failed with liquidation threshold not exceeded");
    } catch (err) {
        console.error(err);
        assert.ok(/6026/.test(err.toString()) || /LiquidationThresholdNotReached/.test(err.toString()));
    }
}

export const liquidateShortPositionWithoutExceedingThreshold = async (ctx: LiquidationContext, {
    minOut,
    interest,
    executionFee,
}: LiquidationArgs = defaultLiquidateShortPositionArgs) => {
    // Use a small swap amount that won't exceed the liquidation threshold
    const smallSwapIn = BigInt(100);
    const smallSwapOut = BigInt(110);

    const instructions = await Promise.all([
        ctx.liquidateShortPositionSetup({ minOut, interest, executionFee }),
        ctx.createABSwapIx({
            swapIn: smallSwapIn,
            swapOut: smallSwapOut,
            poolAtaA: ctx.shortPoolCurrencyVault,
            poolAtaB: ctx.shortPoolCollateralVault
        }),
        ctx.liquidateShortPositionCleanup()
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    try {
        await ctx.send(instructions, ctx.LIQUIDATOR_AUTHORITY);
        assert.fail("Should have failed with liquidation threshold not exceeded");
    } catch (err) {
        console.error(err);
        assert.ok(/6026/.test(err.toString()) || /LiquidationThresholdNotReached/.test(err.toString()));
    }
}
