import {TradeContext, defaultOpenShortPositionArgs} from './tradeContext';
import {validateOpenShortPosition} from './validateTrade';
import {
    openShortPositionWithInvalidSetup,
    openShortPositionWithoutCleanup,
    openShortPositionWithInvalidPool,
    openShortPositionWithoutCosigner,
} from './invalidTrades';

describe("OpenShortPosition", () => {
    let ctx: TradeContext

    before(async () => {
        ctx = await new TradeContext().generateShortTest();
    });

    describe("with more than one setup instruction", () => {
        it("should fail", async () => {
            await openShortPositionWithInvalidSetup(ctx);
        });
    });

    describe("without a cleanup instruction", () => {
        it("should fail", async () => {
            await openShortPositionWithoutCleanup(ctx);
        });
    })

    describe("with one setup and one cleanup ix", () => {
        describe("when amount swapped is more than the sum of downpayment + principal", () => {
            it("should fail", async () => {
                await validateOpenShortPosition(ctx, {...defaultOpenShortPositionArgs, swapIn: BigInt(3_000)});
            });
        });

        describe("with a different pool in the cleanup instruction", () => {
            it("should fail", async () => {
                await openShortPositionWithInvalidPool(ctx);
            });
        });

        describe("without a swap co-signer", () => {
            it("should fail", async () => {
                await openShortPositionWithoutCosigner(ctx);
            });
        });

        describe("correct parameters", () => {
            it("should correctly open a new position", async () => {
                await validateOpenShortPosition(ctx);
            });
        });
    });
});
