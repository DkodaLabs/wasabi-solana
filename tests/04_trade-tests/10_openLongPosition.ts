import { TradeContext, defaultOpenLongPositionArgs } from "./tradeContext";
import { validateOpenLongPosition } from "./validateTrade";
import {
    openLongPositionWithInvalidPool,
    openLongPositionWithInvalidSetup,
    openLongPositionWithoutCleanup,
    openLongPositionWithoutCosigner
} from "./invalidTrades";

describe("OpenLongPosition", () => {
    let ctx: TradeContext;

    before(async () => {
        ctx = await new TradeContext().generateLongTest();
    });

    describe("with more than one setup instruction", () => {
        it("should fail", async () => {
            await openLongPositionWithInvalidSetup(ctx);
        });
    });

    describe("without a cleanup instruction", () => {
        it("should fail", async () => {
            await openLongPositionWithoutCleanup(ctx);
        });
    });

    describe("with one setup and one cleanup ix", () => {
        describe("when amount swapped is more than the sum of downpayment + principal", () => {
            it("should fail", async () => {
                await validateOpenLongPosition(ctx, { ...defaultOpenLongPositionArgs, swapIn: BigInt(3_000) });
            });
        });

        describe("with a different pool in the cleanup instruction", () => {
            it("should fail", async () => {
                await openLongPositionWithInvalidPool(ctx, defaultOpenLongPositionArgs);
            });
        });

        describe("without a swap co-signer", () => {
            it("should fail", async () => {
                await openLongPositionWithoutCosigner(ctx, defaultOpenLongPositionArgs);
            });
        });

        describe("correct parameters", () => {
            it("should correctly open a new position", async () => {
                await validateOpenLongPosition(ctx, defaultOpenLongPositionArgs);
            });
        });
    });
});
