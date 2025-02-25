import {TradeContext} from "./tradeContext";
import {validateCloseLongPosition} from "./validateTrade";
import {
    closeLongPositionWithIncorrectOwner,
    closeLongPositionWithoutCosigner,
    closeLongPositionWithInvalidSetup,
    closeLongPositionWithoutCleanup,
    closeLongPositionWithBadDebt
} from "./invalidTrades";

describe("CloseLongPosition", () => {
    let ctx: TradeContext;

    before(async () => {
        ctx = await new TradeContext().generateLongTestWithDefaultPosition();
        ctx.isCloseTest = true;
    });

    describe("with more than one setup instruction", () => {
        it("should fail", async () => {
            await closeLongPositionWithInvalidSetup(ctx);
        });
    });

    describe("without a cleanup instruction", () => {
        it("should fail", async () => {
            await closeLongPositionWithoutCleanup(ctx);
        });
    });

    describe("with incorrect owner", () => {
        it("should fail", async () => {
            await closeLongPositionWithIncorrectOwner(ctx);
        });
    });

    describe("without a swap co-signer", () => {
        it("should fail", async () => {
            await closeLongPositionWithoutCosigner(ctx);
        });
    });

    describe("with bad debt", () => {
        it("should fail", async () => {
            await closeLongPositionWithBadDebt(ctx);
        });
    });

    describe("with correct parameters", () => {
        it("should correctly close the position", async () => {
            await validateCloseLongPosition(ctx);
        });
    });
});
