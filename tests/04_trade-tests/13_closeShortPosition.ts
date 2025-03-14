import {TradeContext} from './tradeContext';
import {validateCloseShortPosition} from "./validateTrade";
import {
    closeShortPositionWithIncorrectOwner,
    closeShortPositionWithoutCosigner,
    closeShortPositionWithInvalidSetup,
    closeShortPositionWithoutCleanup,
    closeShortPositionWithBadDebt
} from './invalidTrades';

// Since all but the last test fail, there isn't a need to create a new test context
describe("CloseShortPosition", () => {
    let ctx: TradeContext;

    before(async () => {
        ctx = await new TradeContext().generateShortOrderTest();
        ctx.isCloseTest = true;
    });

    describe("with more than one setup instruction", () => {
        it("should fail", async () => {
            await closeShortPositionWithInvalidSetup(ctx);
        });
    });

    describe("without a cleanup instruction", () => {
        it("should fail", async () => {
            await closeShortPositionWithoutCleanup(ctx);
        });
    });

    describe("with incorrect owner", () => {
        it("should fail", async () => {
            await closeShortPositionWithIncorrectOwner(ctx);
        });
    });

    describe("without a swap co-signer", () => {
        it("should fail", async () => {
            await closeShortPositionWithoutCosigner(ctx);
        });
    });

    describe("with bad debt", () => {
        it("should fail", async () => {
            await closeShortPositionWithBadDebt(ctx);
        });
    });

    describe("with the correct parameters", () => {
        it("should correctly close the position", async () => {
            await validateCloseShortPosition(ctx);
        });
    });
});
