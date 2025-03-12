import {assert} from "chai";
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {getMultipleTokenAccounts} from "../utils";
import {
    OrderContext,
    OrderArgs,
    OrderInitArgs,
    defaultInitStopLossOrderArgs,
    defaultInitTakeProfitOrderArgs
} from "./orderContext";
import {defaultTakeProfitOrderArgs, defaultStopLossOrderArgs} from "./orderContext";
import * as anchor from '@coral-xyz/anchor';
import {TransactionInstruction} from "@solana/web3.js";
import {AnchorError, ProgramError} from "@coral-xyz/anchor";

export const validateExecuteTakeProfitOrder = async (
    ctx: OrderContext, {
        makerAmount,
        takerAmount,
    }: OrderInitArgs = defaultInitTakeProfitOrderArgs,
    {
        interest,
        executionFee,
        swapIn,
        swapOut,
    }: OrderArgs = defaultTakeProfitOrderArgs
) => {
    const position = ctx.isLong ? ctx.longPosition : ctx.shortPosition;
    const takeProfitOrder = ctx.isLong ? ctx.longTakeProfitOrder : ctx.shortTakeProfitOrder;

    // Initialize the take profit order
    await ctx.send([await ctx.initTakeProfitOrder({makerAmount, takerAmount})]);

    // Verify the take profit order was created correctly
    const orderBefore = await ctx.program.account.takeProfitOrder.fetch(takeProfitOrder);
    assert.equal(orderBefore.makerAmount.toString(), makerAmount.toString(), "Maker amount should match");
    assert.equal(orderBefore.takerAmount.toString(), takerAmount.toString(), "Taker amount should match");
    assert.equal(orderBefore.position.toString(), position.toString(), "Position should match");

    // Get position before execution
    const positionBefore = await ctx.program.account.position.fetch(position);

    // Get token account balances before execution
    const [vaultBefore, ownerTokenABefore, feeBalanceBefore] = await getMultipleTokenAccounts(
        ctx.program.provider.connection,
        [
            ctx.vault,
            ctx.ownerCurrencyAta,
            ctx.feeWallet,
        ],
        TOKEN_PROGRAM_ID
    );

    // Execute the take profit order
    await ctx.executeTakeProfitOrder({interest, executionFee, swapIn, swapOut});

    // Verify position is closed
    const positionAfter = await ctx.program.account.position.fetchNullable(position);
    assert.isNull(positionAfter, "Position should be closed after take profit execution");

    // Verify take profit order is closed
    const orderAfter = await ctx.program.account.takeProfitOrder.fetchNullable(takeProfitOrder);
    assert.isNull(orderAfter, "Take profit order should be closed");

    // Get token account balances after execution
    const [vaultAfter, ownerTokenAAfter, feeBalanceAfter] = await getMultipleTokenAccounts(
        ctx.program.provider.connection,
        [
            ctx.vault,
            ctx.ownerCurrencyAta,
            ctx.feeWallet,
        ],
        TOKEN_PROGRAM_ID
    );

    // Verify LP vault received principal + interest
    const expectedLpVaultDiff = positionBefore.principal.add(new anchor.BN(interest.toString()));
    const vaultDiff = vaultAfter.amount - vaultBefore.amount;
    assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString(), "LP vault should receive principal + interest");

    // Verify user received payout
    const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
    assert.isTrue(ownerADiff > BigInt(0), "User should receive payout");

    // Verify fee wallet received execution fee
    const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
    assert.equal(feeBalanceDiff.toString(), executionFee.toString(), "Fee wallet should receive execution fee");

    // Verify event was emitted
    assert.ok(ctx.takeProfitEvent, "Take profit event should be emitted");
    assert.equal(
        ctx.takeProfitEvent.id.toString(),
        position.toString(),
        "Position ID in event should match"
    );
    assert.equal(
        ctx.takeProfitEvent.trader.toString(),
        ctx.program.provider.publicKey.toString(),
        "Trader in event should match"
    );
    assert.equal(
        ctx.takeProfitEvent.orderType,
        0, // Take profit order type
        "Order type should be take profit"
    );
}

export const validateExecuteStopLossOrder = async (
    ctx: OrderContext, {
        makerAmount,
        takerAmount,
    }: OrderInitArgs = defaultInitStopLossOrderArgs,
    {
        interest,
        executionFee,
        swapIn,
        swapOut,
    }: OrderArgs = defaultStopLossOrderArgs
) => {
    const position = ctx.isLong ? ctx.longPosition : ctx.shortPosition;
    const stopLossOrder = ctx.isLong ? ctx.longStopLossOrder : ctx.shortStopLossOrder;

    // Initialize the stop loss order
    await ctx.send([await ctx.initStopLossOrder({makerAmount, takerAmount})]);

    // Verify the stop loss order was created correctly
    const orderBefore = await ctx.program.account.stopLossOrder.fetch(stopLossOrder);
    assert.equal(orderBefore.makerAmount.toString(), makerAmount.toString(), "Maker amount should match");
    assert.equal(orderBefore.takerAmount.toString(), takerAmount.toString(), "Taker amount should match");
    assert.equal(orderBefore.position.toString(), position.toString(), "Position should match");

    // Get position before execution
    const positionBefore = await ctx.program.account.position.fetch(position);

    // Get token account balances before execution
    const [vaultBefore, ownerTokenABefore, feeBalanceBefore] = await getMultipleTokenAccounts(
        ctx.program.provider.connection,
        [
            ctx.vault,
            ctx.ownerCurrencyAta,
            ctx.feeWallet,
        ],
        TOKEN_PROGRAM_ID
    );

    // Execute the stop loss order
    await ctx.executeStopLossOrder({interest, executionFee, swapIn, swapOut});

    // Verify position is closed
    const positionAfter = await ctx.program.account.position.fetchNullable(position);
    assert.isNull(positionAfter, "Position should be closed after stop loss execution");

    // Verify stop loss order is closed
    const orderAfter = await ctx.program.account.stopLossOrder.fetchNullable(stopLossOrder);
    assert.isNull(orderAfter, "Stop loss order should be closed");

    // Get token account balances after execution
    const [vaultAfter, ownerTokenAAfter, feeBalanceAfter] = await getMultipleTokenAccounts(
        ctx.program.provider.connection,
        [
            ctx.vault,
            ctx.ownerCurrencyAta,
            ctx.feeWallet,
        ],
        TOKEN_PROGRAM_ID
    );

    // Verify LP vault received principal + interest
    const expectedLpVaultDiff = positionBefore.principal.add(new anchor.BN(interest.toString()));
    const vaultDiff = vaultAfter.amount - vaultBefore.amount;
    assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString(), "LP vault should receive principal + interest");

    // Verify user received payout
    const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
    assert.isTrue(ownerADiff > BigInt(0), "User should receive payout");

    // Verify fee wallet received execution fee
    const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
    assert.equal(feeBalanceDiff.toString(), executionFee.toString(), "Fee wallet should receive execution fee");

    // Verify event was emitted
    assert.ok(ctx.stopLossEvent, "Stop loss event should be emitted");
    assert.equal(
        ctx.stopLossEvent.id.toString(),
        position.toString(),
        "Position ID in event should match"
    );
    assert.equal(
        ctx.stopLossEvent.trader.toString(),
        ctx.program.provider.publicKey.toString(),
        "Trader in event should match"
    );
    assert.equal(
        ctx.stopLossEvent.orderType,
        1, // Stop loss order type
        "Order type should be stop loss"
    );
}

// Invalid order functions
export const initTakeProfitOrder = async (ctx: OrderContext, {
    makerAmount,
    takerAmount,
}: OrderInitArgs = defaultInitTakeProfitOrderArgs) => {
    const position = ctx.isLong ? ctx.longPosition : ctx.shortPosition;
    const takeProfitOrder = ctx.isLong ? ctx.longTakeProfitOrder : ctx.shortTakeProfitOrder;

    // Initialize the take profit order
    await ctx.send([await ctx.initTakeProfitOrder({makerAmount, takerAmount})]);

    // Verify the take profit order was created correctly
    const order = await ctx.program.account.takeProfitOrder.fetch(takeProfitOrder);
    assert.equal(order.makerAmount.toString(), makerAmount.toString(), "Maker amount should match");
    assert.equal(order.takerAmount.toString(), takerAmount.toString(), "Taker amount should match");
    assert.equal(order.position.toString(), position.toString(), "Position should match");

    return order;
}

export const initStopLossOrder = async (ctx: OrderContext, {
    makerAmount,
    takerAmount,
}: OrderInitArgs = defaultInitStopLossOrderArgs) => {
    const position = ctx.isLong ? ctx.longPosition : ctx.shortPosition;
    const stopLossOrder = ctx.isLong ? ctx.longStopLossOrder : ctx.shortStopLossOrder;

    // Initialize the stop loss order
    await ctx.send([await ctx.initStopLossOrder({makerAmount, takerAmount})]);

    // Verify the stop loss order was created correctly
    const order = await ctx.program.account.stopLossOrder.fetch(stopLossOrder);
    assert.equal(order.makerAmount.toString(), makerAmount.toString(), "Maker amount should match");
    assert.equal(order.takerAmount.toString(), takerAmount.toString(), "Taker amount should match");
    assert.equal(order.position.toString(), position.toString(), "Position should match");

    return order;
}

export const cancelTakeProfitOrderWithInvalidPermission = async (ctx: OrderContext) => {
    const position = ctx.isLong ? ctx.longPosition : ctx.shortPosition;
    const takeProfitOrder = ctx.isLong ? ctx.longTakeProfitOrder : ctx.shortTakeProfitOrder;

    // Initialize the take profit order
    await initTakeProfitOrder(ctx);

    // Try to cancel with invalid permission
    try {
        await ctx.send([
            await ctx.program.methods
                .closeTakeProfitOrder()
                .accounts({
                    closer: ctx.NON_ORDER_AUTHORITY.publicKey,
                    //@ts-ignore
                    trader:     ctx.program.provider.publicKey,
                    permission: ctx.nonOrderPermission,
                    position:   position,
                })
                .instruction()
        ], ctx.NON_ORDER_AUTHORITY);

        assert.fail("Should have failed with invalid permissions");
    } catch (err) {
        console.error(err);
        assert.ok(/6000/.test(err.toString()) || /InvalidPermissions/.test(err.toString()));
    }

    // Verify the take profit order still exists
    const order = await ctx.program.account.takeProfitOrder.fetch(takeProfitOrder);
    assert.ok(order, "Take profit order should still exist");
}

export const cancelStopLossOrderWithInvalidPermission = async (ctx: OrderContext) => {
    const position = ctx.isLong ? ctx.longPosition : ctx.shortPosition;
    const stopLossOrder = ctx.isLong ? ctx.longStopLossOrder : ctx.shortStopLossOrder;

    // Initialize the stop loss order
    await initStopLossOrder(ctx);

    // Try to cancel with invalid permission
    try {
        await ctx.send([
            await ctx.program.methods
                .closeStopLossOrder()
                .accounts({
                    closer: ctx.NON_ORDER_AUTHORITY.publicKey,
                    //@ts-ignore
                    trader:     ctx.program.provider.publicKey,
                    permission: ctx.nonOrderPermission,
                    position:   position,
                })
                .instruction()
        ], ctx.NON_ORDER_AUTHORITY);

        assert.fail("Should have failed with invalid permissions");
    } catch (err) {
        console.error(err);
        assert.ok(/6000/.test(err.toString()) || /InvalidPermissions/.test(err.toString()));
    }

    // Verify the stop loss order still exists
    const order = await ctx.program.account.stopLossOrder.fetch(stopLossOrder);
    assert.ok(order, "Stop loss order should still exist");
}

export const cancelTakeProfitOrderWithUser = async (ctx: OrderContext) => {
    const takeProfitOrder = ctx.isLong ? ctx.longTakeProfitOrder : ctx.shortTakeProfitOrder;

    // Initialize the take profit order
    await initTakeProfitOrder(ctx);

    // Cancel with user
    await ctx.send([await ctx.cancelTakeProfitOrder()]);

    // Verify the take profit order is closed
    const order = await ctx.program.account.takeProfitOrder.fetchNullable(takeProfitOrder);
    assert.isNull(order, "Take profit order should be closed");
}

export const cancelStopLossOrderWithUser = async (ctx: OrderContext) => {
    const stopLossOrder = ctx.isLong ? ctx.longStopLossOrder : ctx.shortStopLossOrder;

    // Initialize the stop loss order
    await initStopLossOrder(ctx);

    // Cancel with user
    await ctx.send([await ctx.cancelStopLossOrder()]);

    // Verify the stop loss order is closed
    const order = await ctx.program.account.stopLossOrder.fetchNullable(stopLossOrder);
    assert.isNull(order, "Stop loss order should be closed");
}

export const cancelTakeProfitOrderWithAdmin = async (ctx: OrderContext) => {
    const takeProfitOrder = ctx.isLong ? ctx.longTakeProfitOrder : ctx.shortTakeProfitOrder;

    // Initialize the take profit order
    await initTakeProfitOrder(ctx);

    // Cancel with admin
    await ctx.send([await ctx.cancelTakeProfitOrder()], ctx.ORDER_AUTHORITY);

    // Verify the take profit order is closed
    const order = await ctx.program.account.takeProfitOrder.fetchNullable(takeProfitOrder);
    assert.isNull(order, "Take profit order should be closed");
}

export const cancelStopLossOrderWithAdmin = async (ctx: OrderContext) => {
    const stopLossOrder = ctx.isLong ? ctx.longStopLossOrder : ctx.shortStopLossOrder;

    // Initialize the stop loss order
    await initStopLossOrder(ctx);

    // Cancel with admin
    await ctx.send([await ctx.cancelStopLossOrder()], ctx.ORDER_AUTHORITY);

    // Verify the stop loss order is closed
    const order = await ctx.program.account.stopLossOrder.fetchNullable(stopLossOrder);
    assert.isNull(order, "Stop loss order should be closed");
}

export const executeTakeProfitOrderWithInvalidAuthority = async (ctx: OrderContext, {
    interest,
    executionFee,
    swapIn,
    swapOut,
}: OrderArgs = defaultTakeProfitOrderArgs) => {
    const position = ctx.isLong ? ctx.longPosition : ctx.shortPosition;
    const takeProfitOrder = ctx.isLong ? ctx.longTakeProfitOrder : ctx.shortTakeProfitOrder;

    // Initialize the take profit order
    await initTakeProfitOrder(ctx);

    // Try to execute with invalid authority
    try {
        const instructions = await Promise.all([
            ctx.program.methods
                .takeProfitSetup(
                    new anchor.BN(0), // minTargetAmount
                    new anchor.BN(interest.toString()),
                    new anchor.BN(executionFee.toString()),
                    new anchor.BN(Date.now() / 1_000 + 60 * 60)
                )
                .accounts({
                    closePositionSetup: {
                        owner:      ctx.program.provider.publicKey,
                        position:   position,
                        pool:       ctx.isLong ? ctx.longPool : ctx.shortPool,
                        collateral: ctx.collateral,
                        //@ts-ignore
                        authority:    ctx.NON_ORDER_AUTHORITY.publicKey,
                        permission:   ctx.nonOrderPermission,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    },
                })
                .instruction(),
            ctx.isLong ?
                ctx.createBASwapIx({
                    swapIn,
                    swapOut,
                    poolAtaA: ctx.longPoolCurrencyVault,
                    poolAtaB: ctx.longPoolCollateralVault
                }) :
                ctx.createABSwapIx({
                    swapIn,
                    swapOut,
                    poolAtaA: ctx.shortPoolCurrencyVault,
                    poolAtaB: ctx.shortPoolCollateralVault
                }),
            ctx.takeProfitCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions, ctx.NON_ORDER_AUTHORITY);
        assert.fail("Should have failed with invalid authority");
    } catch (err) {
        console.error(err);
        assert.ok(/6000/.test(err.toString()) || /InvalidPermissions/.test(err.toString()));
    }

    // Verify the take profit order still exists
    const order = await ctx.program.account.takeProfitOrder.fetch(takeProfitOrder);
    assert.ok(order, "Take profit order should still exist");
}

export const executeStopLossOrderWithInvalidAuthority = async (ctx: OrderContext, {
    interest,
    executionFee,
    swapIn,
    swapOut,
}: OrderArgs = defaultStopLossOrderArgs) => {
    const position = ctx.isLong ? ctx.longPosition : ctx.shortPosition;
    const stopLossOrder = ctx.isLong ? ctx.longStopLossOrder : ctx.shortStopLossOrder;

    // Initialize the stop loss order
    await initStopLossOrder(ctx);

    // Try to execute with invalid authority
    try {
        const instructions = await Promise.all([
            ctx.program.methods
                .stopLossSetup(
                    new anchor.BN(0), // minTargetAmount
                    new anchor.BN(interest.toString()),
                    new anchor.BN(executionFee.toString()),
                    new anchor.BN(Date.now() / 1_000 + 60 * 60)
                )
                .accounts({
                    closePositionSetup: {
                        owner:      ctx.program.provider.publicKey,
                        position:   position,
                        pool:       ctx.isLong ? ctx.longPool : ctx.shortPool,
                        collateral: ctx.collateral,
                        //@ts-ignore
                        authority:    ctx.NON_ORDER_AUTHORITY.publicKey,
                        permission:   ctx.nonOrderPermission,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    },
                })
                .instruction(),
            ctx.isLong ?
                ctx.createBASwapIx({
                    swapIn,
                    swapOut,
                    poolAtaA: ctx.longPoolCurrencyVault,
                    poolAtaB: ctx.longPoolCollateralVault
                }) :
                ctx.createABSwapIx({
                    swapIn,
                    swapOut,
                    poolAtaA: ctx.shortPoolCurrencyVault,
                    poolAtaB: ctx.shortPoolCollateralVault
                }),
            ctx.stopLossCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        await ctx.send(instructions, ctx.NON_ORDER_AUTHORITY);
        assert.fail("Should have failed with invalid authority");
    } catch (err) {
        console.error(err);
        assert.ok(/6000/.test(err.toString()) || /InvalidPermissions/.test(err.toString()));
    }

    // Verify the stop loss order still exists
    const order = await ctx.program.account.stopLossOrder.fetch(stopLossOrder);
    assert.ok(order, "Stop loss order should still exist");
}

export const executeTakeProfitOrderWithInvalidTakerAmount = async (ctx: OrderContext, {
    interest,
    executionFee,
}: OrderArgs = defaultTakeProfitOrderArgs) => {
    const takeProfitOrder = ctx.isLong ? ctx.longTakeProfitOrder : ctx.shortTakeProfitOrder;

    // Initialize the take profit order with high taker amount requirement
    await initTakeProfitOrder(ctx, {
        makerAmount: BigInt(100),
        takerAmount: BigInt(10000), // Very high taker amount that won't be met
    });

    // Try to execute with insufficient swap amount
    try {
        await ctx.executeTakeProfitOrder({
            interest,
            executionFee,
            swapIn:  BigInt(100), // Small swap amount
            swapOut: BigInt(110), // Small swap out amount
        });

        assert.fail("Should have failed with taker amount not met");
    } catch (err) {
        console.error(err);
        assert.ok(/6017/.test(err.toString()) || /TakerAmountNotMet/.test(err.toString()));
    }

    // Verify the take profit order still exists
    const order = await ctx.program.account.takeProfitOrder.fetch(takeProfitOrder);
    assert.ok(order, "Take profit order should still exist");
}

export const executeStopLossOrderWithInvalidTakerAmount = async (ctx: OrderContext, {
    interest,
    executionFee,
}: OrderArgs = defaultStopLossOrderArgs) => {
    const stopLossOrder = ctx.isLong ? ctx.longStopLossOrder : ctx.shortStopLossOrder;

    // Initialize the stop loss order with high taker amount requirement
    await initStopLossOrder(ctx, {
        makerAmount: BigInt(100),
        takerAmount: BigInt(10000), // Very high taker amount that won't be met
    });

    // Try to execute with insufficient swap amount
    try {
        await ctx.executeStopLossOrder({
            interest,
            executionFee,
            swapIn:  BigInt(100), // Small swap amount
            swapOut: BigInt(110), // Small swap out amount
        });

        assert.fail("Should have failed with taker amount not met");
    } catch (err) {
        console.error(err);
        assert.ok(/6017/.test(err.toString()) || /TakerAmountNotMet/.test(err.toString()));
    }

    // Verify the stop loss order still exists
    const order = await ctx.program.account.stopLossOrder.fetch(stopLossOrder);
    assert.ok(order, "Stop loss order should still exist");
}
