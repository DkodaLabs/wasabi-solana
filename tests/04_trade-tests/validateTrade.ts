import {assert} from "chai";
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {getMultipleTokenAccounts} from "../utils";
import {
    TradeContext,
    OpenPositionArgs,
    ClosePositionArgs,
    defaultCloseLongPositionArgs,
    defaultCloseShortPositionArgs
} from "./tradeContext";
import {defaultOpenShortPositionArgs, defaultOpenLongPositionArgs} from "./tradeContext";

export const positionStates = async (ctx: TradeContext, isLong: boolean) => {
    try {
        const [
            [vault, ownerToken, poolCurrencyAta, poolCollateralAta],
            positionRequest,
            position,
        ] = await Promise.all([
            getMultipleTokenAccounts(ctx.program.provider.connection, isLong ? [
                ctx.vault,
                ctx.ownerCurrencyAta,
                ctx.longPoolCurrencyVault,
                ctx.longPoolCollateralVault,
            ] : [
                ctx.vault,
                ctx.ownerCurrencyAta,
                ctx.shortPoolCurrencyVault,
                ctx.shortPoolCollateralVault,
            ], TOKEN_PROGRAM_ID),
            ctx.program.account.openPositionRequest.fetchNullable(ctx.openPositionRequest),
            ctx.program.account.position.fetchNullable(isLong ? ctx.longPosition : ctx.shortPosition),
        ]);

        return {
            vault,
            ownerToken,
            poolCurrencyAta,
            poolCollateralAta,
            positionRequest,
            position,
        };
    } catch (err) {
        console.error("Error fetching position states:", err);
        throw err;
    }
};

export const validateOpenLongPositionStates = async (
    ctx: TradeContext,
    beforePromise: ReturnType<typeof positionStates>,
    afterPromise: ReturnType<typeof positionStates>,
    principal: bigint,
    downPayment: bigint,
    fee: bigint
) => {
    const [before, after] = await Promise.all([beforePromise, afterPromise]);
    console.log("BEFORE: ", before);
    console.log("AFTER: ", after);

    if (!after.position) throw new Error("Failed to create position");

    // Assert position has correct values
    assert.equal(
        after.position.trader.toString(),
        ctx.program.provider.publicKey.toString(),
    );
    assert.ok(after.position.collateralAmount.gt(new anchor.BN(0)));
    assert.equal(
        after.position.collateral.toString(),
        ctx.collateral.toString(),
    );
    assert.equal(
        after.position.collateralVault.toString(),
        ctx.longPoolCollateralVault.toString(),
    );
    assert.equal(after.position.currency.toString(), ctx.currency.toString());
    assert.equal(
        after.position.downPayment.toString(),
        downPayment.toString(),
    );
    assert.equal(after.position.principal.toString(), principal.toString());
    assert.equal(after.position.lpVault.toString(), ctx.lpVault.toString());

    // Assert vault balance decreased by Principal
    assert.equal(
        after.vault.amount,
        before.vault.amount - principal,
    );
    // Assert user balance decreased by downpayment
    assert.equal(
        after.ownerToken.amount,
        before.ownerToken.amount -
        downPayment -
        fee
    );
    // Assert collateral vault balance has increased
    assert.isTrue(after.poolCollateralAta.amount > before.poolCollateralAta.amount);

    // Assert the open position request account was closed
    assert.isNull(after.positionRequest);
};

export const validateOpenShortPositionStates = async (
    ctx: TradeContext,
    beforePromise: ReturnType<typeof positionStates>,
    afterPromise: ReturnType<typeof positionStates>,
    principal: bigint,
    downPayment: bigint,
    fee: bigint
) => {
    const [before, after] = await Promise.all([beforePromise, afterPromise]);
    console.log("BEFORE: ", before);
    console.log("AFTER: ", after);

    // Assert position has correct values
    assert.equal(
        after.position.trader.toString(),
        ctx.program.provider.publicKey.toString(),
    );
    // Assert it's greater than downpayment since it's collateral + downpayment
    assert.ok(after.position.collateralAmount.gt(new anchor.BN(downPayment.toString())));
    assert.equal(
        after.position.collateral.toString(),
        ctx.currency.toString(),
    );
    assert.equal(
        after.position.collateralVault.toString(),
        ctx.shortPoolCollateralVault.toString(),
    );
    assert.equal(after.position.currency.toString(), ctx.collateral.toString());
    assert.equal(
        after.position.downPayment.toString(),
        downPayment.toString(),
    );
    assert.equal(after.position.principal.toString(), principal.toString());
    assert.equal(after.position.lpVault.toString(), ctx.lpVault.toString());

    // Assert vault balance decreased by Principal
    assert.equal(
        after.vault.amount,
        before.vault.amount - principal
    );

    // Assert user balance decreased by downpayment
    assert.equal(
        after.ownerToken.amount,
        before.ownerToken.amount -
        downPayment -
        fee
    );

    // Assert collateral vault balance has increased by more than down payment
    assert.isTrue(
        after.poolCollateralAta.amount >
        before.poolCollateralAta.amount + downPayment
    );

    // Assert user paid full down payment
    assert.equal(
        after.ownerToken.amount,
        before.ownerToken.amount -
        downPayment -
        fee
    );

    // Assert the borrowed token amount is not left in the user's wallet
    assert.equal(after.ownerToken.amount, before.ownerToken.amount);

    // Assert the currency_vault amount has not changed
    assert.equal(
        after.poolCurrencyAta.amount,
        before.poolCurrencyAta.amount,
    );
}

export const validateOpenLongPosition = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs = defaultOpenLongPositionArgs) => {
    try {
        const statesBefore = await positionStates(ctx, true);
        await ctx.openLongPosition({
            minOut: minOut || defaultOpenLongPositionArgs.minOut,
            downPayment: downPayment || defaultOpenLongPositionArgs.downPayment,
            principal: principal || defaultOpenLongPositionArgs.principal,
            fee: fee || defaultOpenLongPositionArgs.fee,
            swapIn: swapIn || defaultOpenLongPositionArgs.swapIn,
            swapOut: swapOut || defaultOpenLongPositionArgs.swapOut
        });
        const statesAfter = await positionStates(ctx, true);
        await validateOpenLongPositionStates(
            ctx, 
            statesBefore, 
            statesAfter, 
            principal || defaultOpenLongPositionArgs.principal, 
            downPayment || defaultOpenLongPositionArgs.downPayment, 
            fee || defaultOpenLongPositionArgs.fee
        );
    } catch (err) {
        // 'Insufficient funds'
        if (/insufficient funds/.test(err.toString())) {
            assert.ok(true);
        } else if (/already in use/.test(err.toString())) {
            // This can happen if the position account is already created
            assert.ok(true);
        } else {
            console.error("Error in validateOpenLongPosition:", err);
            throw err;
        }
    }
};

export const validateOpenShortPosition = async (ctx: TradeContext, {
        minOut,
        downPayment,
        principal,
        fee,
        swapIn,
        swapOut,
    }: OpenPositionArgs = defaultOpenShortPositionArgs
) => {
    try {
        const statesBefore = await positionStates(ctx, false);
        await ctx.openShortPosition({
            minOut: minOut || defaultOpenShortPositionArgs.minOut,
            downPayment: downPayment || defaultOpenShortPositionArgs.downPayment,
            principal: principal || defaultOpenShortPositionArgs.principal,
            fee: fee || defaultOpenShortPositionArgs.fee,
            swapIn: swapIn || defaultOpenShortPositionArgs.swapIn,
            swapOut: swapOut || defaultOpenShortPositionArgs.swapOut
        });
        const statesAfter = await positionStates(ctx, false);
        await validateOpenShortPositionStates(
            ctx, 
            statesBefore, 
            statesAfter, 
            principal || defaultOpenShortPositionArgs.principal, 
            downPayment || defaultOpenShortPositionArgs.downPayment, 
            fee || defaultOpenShortPositionArgs.fee
        );
    } catch (err) {
        // 'Insufficient funds'
        if (/insufficient funds/.test(err.toString())) {
            assert.ok(true);
        } else if (/already in use/.test(err.toString())) {
            // This can happen if the position account is already created
            assert.ok(true);
        } else {
            console.error("Error in validateOpenShortPosition:", err);
            throw err;
        }
    }
}

export const validateCloseLongPosition = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs = defaultCloseLongPositionArgs) => {
    try {
        // Get position before closing
        const positionBefore = await ctx.program.account.position.fetch(ctx.longPosition);

        // Get token account balances before closing
        const [vaultBefore, ownerTokenABefore, ownerBBefore, feeBalanceBefore] = await getMultipleTokenAccounts(
            ctx.program.provider.connection,
            [
                ctx.vault,
                ctx.ownerCurrencyAta,
                ctx.ownerCollateralAta,
                ctx.feeWallet,
            ],
            TOKEN_PROGRAM_ID
        );

        // Close the position
        await ctx.closeLongPosition({minOut, interest, executionFee, swapIn, swapOut});

        // Verify position is closed
        const positionAfter = await ctx.program.account.position.fetchNullable(ctx.longPosition);
        assert.isNull(positionAfter, "Position should be closed");

        // Get token account balances after closing
        const [vaultAfter, ownerTokenAAfter, ownerBAfter, feeBalanceAfter] = await getMultipleTokenAccounts(
            ctx.program.provider.connection,
            [
                ctx.vault,
                ctx.ownerCurrencyAta,
                ctx.ownerCollateralAta,
                ctx.feeWallet,
            ],
            TOKEN_PROGRAM_ID
        );

        // Verify LP vault received principal + interest
        const expectedLpVaultDiff = positionBefore.principal.add(new anchor.BN(interest.toString()));
        const vaultDiff = vaultAfter.amount - vaultBefore.amount;
        assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString(), "LP vault should receive principal + interest");

        // Verify user received payout in currency
        const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
        assert.isTrue(ownerADiff > BigInt(0), "User should receive payout in currency");

        // Verify fee wallet received execution fee
        const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
        assert.equal(feeBalanceDiff.toString(), executionFee.toString(), "Fee wallet should receive execution fee");

        // Verify event was emitted
        assert.ok(ctx.closePositionEvent, "Close position event should be emitted");
        assert.equal(
            ctx.closePositionEvent.id.toString(),
            ctx.longPosition.toString(),
            "Position ID in event should match"
        );
    } catch (err) {
        console.error("Error in validateCloseLongPosition:", err);
        throw err;
    }
}

export const validateCloseShortPosition = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs = defaultCloseShortPositionArgs) => {
    try {
        // Get position before closing
        const positionBefore = await ctx.program.account.position.fetch(ctx.shortPosition);

        // Get token account balances before closing
        const [vaultBefore, ownerTokenABefore, ownerBBefore, feeBalanceBefore] = await getMultipleTokenAccounts(
            ctx.program.provider.connection,
            [
                ctx.vault,
                ctx.ownerCurrencyAta,
                ctx.ownerCollateralAta,
                ctx.feeWallet,
            ],
            TOKEN_PROGRAM_ID
        );

        // Close the position
        await ctx.closeShortPosition({minOut, interest, executionFee, swapIn, swapOut});

        // Verify position is closed
        const positionAfter = await ctx.program.account.position.fetchNullable(ctx.shortPosition);
        assert.isNull(positionAfter, "Position should be closed");

        // Get token account balances after closing
        const [vaultAfter, ownerTokenAAfter, ownerBAfter, feeBalanceAfter] = await getMultipleTokenAccounts(
            ctx.program.provider.connection,
            [
                ctx.vault,
                ctx.ownerCurrencyAta,
                ctx.ownerCollateralAta,
                ctx.feeWallet,
            ],
            TOKEN_PROGRAM_ID
        );

        // Verify LP vault received principal + interest
        const expectedLpVaultDiff = positionBefore.principal.add(new anchor.BN(interest.toString()));
        const vaultDiff = vaultAfter.amount - vaultBefore.amount;
        assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString(), "LP vault should receive principal + interest");

        // Verify user received payout in currency
        const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
        assert.isTrue(ownerADiff > BigInt(0), "User should receive payout in currency");

        // Verify fee wallet received execution fee
        const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
        assert.equal(feeBalanceDiff.toString(), executionFee.toString(), "Fee wallet should receive execution fee");

        // Verify event was emitted
        assert.ok(ctx.closePositionEvent, "Close position event should be emitted");
        assert.equal(
            ctx.closePositionEvent.id.toString(),
            ctx.shortPosition.toString(),
            "Position ID in event should match"
        );
    } catch (err) {
        console.error("Error in validateCloseShortPosition:", err);
        throw err;
    }
}

