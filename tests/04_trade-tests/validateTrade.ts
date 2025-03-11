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

export type ValidationParams = {
    amountIn: number,
    amountOut: number,
};

export type OpenPositionValidationParams = {
    before: ReturnType<typeof positionStates>,
    after: ReturnType<typeof positionStates>,
    principal: bigint,
    downPayment: bigint,
    fee: bigint
};

export const validate = async (
    ctx: TradeContext,
    f: (params: ValidationParams) => Promise<void>,
    params: ValidationParams,
    validateStates: (ctx: TradeContext, params: OpenPositionValidationParams) => Promise<void>,
    stateParams: OpenPositionValidationParams,
) => {
    const before = positionStates(ctx, ctx.isLongTest);
    await f(params);
    await validateStates(ctx, {before, after: positionStates(ctx, ctx.isLongTest), ...stateParams});
};

export const validateOpenLongPosition = async (ctx: TradeContext, {
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs) => {
    const statesBefore = positionStates(ctx, true);
    await ctx.openLongPosition({minOut, downPayment, principal, fee, swapIn, swapOut});
    const statesAfter = positionStates(ctx, true);
    await validateOpenLongPositionStates(ctx, statesBefore, statesAfter, principal, downPayment, fee);
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

        const statesBefore = positionStates(ctx, false);
        await ctx.openShortPosition({minOut, downPayment, principal, fee, swapIn, swapOut});
        const statesAfter = positionStates(ctx, false);
        await validateOpenShortPositionStates(ctx, statesBefore, statesAfter, principal, downPayment, fee);

        assert.ok(false);
    } catch (err) {
        console.error(err);
        // 'Insufficient funds'
        assert.ok(/insufficient funds/.test(err.toString()));
    }
}

export const validateCloseLongPosition = async (ctx: TradeContext, {
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs = defaultCloseLongPositionArgs) => {
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
    assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString());

    // Verify user received payout in currency
    const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
    assert.isTrue(ownerADiff > BigInt(0), "User should receive payout in currency");

    // Verify fee wallet received execution fee
    const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
    assert.equal(feeBalanceDiff.toString(), executionFee.toString());

    // Verify event was emitted
    assert.ok(ctx.closePositionEvent, "Close position event should be emitted");
    assert.equal(
        ctx.closePositionEvent.id.toString(),
        ctx.longPosition.toString(),
        "Position ID in event should match"
    );
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
        assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString());

        // Verify user received payout in collateral
        const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
        assert.isTrue(ownerADiff > BigInt(0), "User should receive payout in currency");

        // Verify fee wallet received execution fee
        const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
        assert.equal(feeBalanceDiff.toString(), executionFee.toString());

        // Verify event was emitted
        assert.ok(ctx.closePositionEvent, "Close position event should be emitted");
        assert.equal(
            ctx.closePositionEvent.id.toString(),
            ctx.shortPosition.toString(),
            "Position ID in event should match"
        );

    } catch (err) {
        console.error(err);
        assert.ok(false);
    }
}

