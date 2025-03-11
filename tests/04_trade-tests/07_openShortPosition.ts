import {assert} from "chai";
import {AnchorError, ProgramError} from "@coral-xyz/anchor";
import {TradeContext, defaultOpenShortPositionArgs} from "./tradeContext";
import {validateOpenShortPosition} from "./validateTrade";
import {
    openShortPositionWithInvalidPool,
    openShortPositionWithInvalidPosition, openShortPositionWithInvalidSetup, openShortPositionWithoutCleanup,
    openShortPositionWithoutCosigner
} from "./invalidTrades";

describe("OpenShortPosition", () => {
    let ctx: TradeContext;

    before(async () => {
        ctx = await new TradeContext().generateShortTest();
    });

    describe("with more than one setup instruction", () => {
        it("should fail", async () => {
            await openShortPositionWithInvalidSetup(ctx);
        });
    });

    describe("without a cleanup instruction", () => {
        before(async () => {
            ctx = await new TradeContext().generateShortTest();
        });

        it("should fail", async () => {
            await openShortPositionWithoutCleanup(ctx);
        });
    });

    describe("with one setup and one cleanup ix", () => {
        before(async () => {
            ctx = await new TradeContext().generateShortTest();
        });

        describe("when amount swapped is more than the sum of downpayment + principal", () => {
            it("should fail", async () => {
                await validateOpenShortPosition(ctx, {...defaultOpenShortPositionArgs, swapIn: BigInt(3_000)});
            });
        });

        describe("with a different pool in the cleanup instruction", () => {
            it("should fail", async () => {
                await openShortPositionWithInvalidPool(ctx, defaultOpenShortPositionArgs);
            });
        });

        describe("with an incorrect position", () => {
            it("should fail", async () => {
                await openShortPositionWithInvalidPosition(ctx, defaultOpenShortPositionArgs);
            });
        });

        describe("without a swap co-signer", () => {
            it("should fail", async () => {
                await openShortPositionWithoutCosigner(ctx, defaultOpenShortPositionArgs);
            });
        });

        describe("correct parameters", () => {
            it("should correctly open a new position", async () => {
                await validateOpenShortPosition(ctx, defaultOpenShortPositionArgs);
            });
        });
    });
});
