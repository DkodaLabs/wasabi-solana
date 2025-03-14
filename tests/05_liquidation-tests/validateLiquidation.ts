import { assert } from "chai";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getMultipleTokenAccounts } from "../utils";
import { LiquidationContext, LiquidationArgs } from "./liquidationContext";
import { defaultLiquidateLongPositionArgs, defaultLiquidateShortPositionArgs } from "./liquidationContext";
import * as anchor from '@coral-xyz/anchor';


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
    await ctx.liquidateLongPosition({
        minOut,
        interest,
        executionFee,
        swapIn,
        swapOut,
        authority: ctx.SWAP_AUTHORITY.publicKey
    });

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

    assert.ok(ctx.liquidationEvent, "Liquidation event should be emitted");
    assert.equal(
        ctx.liquidationEvent.id.toString(),
        ctx.longPosition.toString(),
        "Position ID in event should match"
    );

    // Verify liquidation wallet received liquidation fee
    const liquidationWalletDiff = liquidationWalletAfter.amount - liquidationWalletBefore.amount;
    assert.isTrue(liquidationWalletDiff > BigInt(0), "Liquidation wallet should receive liquidation fee");

    // Verify fee wallet received execution fee
    const feeWalletDiff = feeWalletAfter.amount - feeWalletBefore.amount;
    assert.equal(feeWalletDiff.toString(), ctx.liquidationEvent.feeAmount.toString(), "Fee wallet should receive execution fee");

    // Verify LP vault received principal + interest
    const expectedLpVaultDiff = positionBefore.principal.add(new anchor.BN(interest.toString()));
    const vaultDiff = vaultAfter.amount - vaultBefore.amount;
    assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString(), "LP vault should receive principal + interest");
    assert.equal(
        ctx.liquidationEvent.trader.toString(),
        ctx.program.provider.publicKey.toString(),
        "Trader in event should match"
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
    await ctx.liquidateShortPosition({
        minOut,
        interest,
        executionFee,
        swapIn,
        swapOut,
        authority: ctx.SWAP_AUTHORITY.publicKey
    });

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

    console.log(ctx.liquidationEvent.feeAmount.toString());

    // Verify LP vault received principal + interest
    const expectedLpVaultDiff = positionBefore.principal.add(new anchor.BN(interest.toString()));
    const vaultDiff = vaultAfter.amount - vaultBefore.amount;
    assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString(), "LP vault should receive principal + interest");

    //// Verify liquidation wallet received liquidation fee
    const liquidationWalletDiff = liquidationWalletAfter.amount - liquidationWalletBefore.amount;
    assert.isTrue(liquidationWalletDiff > 0, "Liquidation wallet should receive liquidation fee");

    // Verify fee wallet received execution fee
    const feeWalletDiff = feeWalletAfter.amount - feeWalletBefore.amount;
    assert.equal(feeWalletDiff.toString(), ctx.liquidationEvent.feeAmount.toString(), "Fee wallet should receive execution fee");

}

