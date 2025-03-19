import {assert} from "chai";
import {
    defaultDecreaseLongPositionArgs,
    defaultDecreaseShortPositionArgs,
    defaultIncreaseLongPositionArgs,
    defaultIncreaseShortPositionArgs,
    EditPositionContext
} from "./editPositionContext";
import {getMultipleTokenAccounts} from "../utils";
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {PublicKey} from "@solana/web3.js";
import {defaultCloseLongPositionArgs, defaultCloseShortPositionArgs} from "../04_trade-tests/tradeContext";

export const getAccountStates = async (ctx: EditPositionContext) => {
    const [ownerToken, positionAddress] = ctx.isLongTest
        ? [ctx.ownerCurrencyAta, ctx.longPosition]
        : [ctx.ownerCurrencyAta, ctx.shortPosition]
    const [position, lpVault, [vault, ownerTokenAccount]] = await Promise.all([
        ctx.program.account.position.fetchNullable(positionAddress),
        ctx.program.account.lpVault.fetchNullable(ctx.lpVault),
        getMultipleTokenAccounts(ctx.program.provider.connection, [ctx.vault, ownerToken], TOKEN_PROGRAM_ID)

    ]);
    return {
        position,
        lpVault,
        vault,
        ownerTokenAccount,
    };
}

export const validateIncreasePosition = async (ctx: EditPositionContext) => {
    try {
        const {downPayment, principal, fee} = ctx.isLongTest
            ? defaultIncreaseLongPositionArgs
            : defaultIncreaseShortPositionArgs;
        const stateBefore = getAccountStates(ctx);
        ctx.isLongTest
            ? await ctx.increaseLongPosition(defaultIncreaseLongPositionArgs)
            : await ctx.increaseShortPosition(defaultIncreaseShortPositionArgs);

        const [before, after] = await Promise.all([stateBefore, getAccountStates(ctx)]);

        assert.ok(ctx.increasePositionEvent, "increase event should be emitted");

        const expectedLpVaultDiff = before.position.principal + new anchor.BN(principal.toString());
        const vaultDiff = after.vault.amount - before.vault.amount;
        assert.equal(vaultDiff, expectedLpVaultDiff);

        assert.equal(vaultDiff, ctx.increasePositionEvent.principal, "event principal should match vault diff");

        const ownerDiff = after.ownerTokenAccount.amount - before.ownerTokenAccount.amount;
        assert.equal(ownerDiff, downPayment, "owner token account should have been deducted");
    } catch (err) {
        console.error(err);
    }
}

export const validateDecreasePosition = async (ctx: EditPositionContext) => {
    try {
        let interest: bigint;
        let executionFee: bigint;
        const stateBefore = getAccountStates(ctx);

        if (ctx.isLongTest) {
            interest = defaultCloseLongPositionArgs.interest;
            executionFee = defaultCloseLongPositionArgs.executionFee;

            await ctx.decreaseLongPosition(defaultDecreaseLongPositionArgs);
        } else {
            interest = defaultCloseShortPositionArgs.interest;
            executionFee = defaultCloseShortPositionArgs.executionFee;
            await ctx.decreaseShortPosition(defaultDecreaseShortPositionArgs);
        }

        const [before, after] = await Promise.all([stateBefore, getAccountStates(ctx)]);

        assert.ok(ctx.decreasePositionEvent, "decrease event should be emitted");

    } catch (err) {
        console.error(err);
    }
}