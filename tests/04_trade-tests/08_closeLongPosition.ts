import { assert } from "chai";
import { AnchorError, ProgramError } from "@coral-xyz/anchor";
import { TradeContext, defaultCloseLongPositionArgs } from "./tradeContext";
import { validateCloseLongPosition } from "./validateTrade";
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
            try {
                await closeLongPositionWithInvalidSetup(ctx);
                assert.ok(false);
            } catch (err) {
                console.error(err);
                // 'Account already exists'
                assert.ok(/already in use/.test(err.toString()));
            }
        });
    });
    
    describe("without a cleanup instruction", () => {
        it("should fail", async () => {
            try {
                await closeLongPositionWithoutCleanup(ctx);
                assert.ok(false);
            } catch (err) {
                console.error(err);
                // 'Missing cleanup'
                assert.ok(/6002/.test(err.toString()))
            }
        });
    });
    
    describe("with incorrect owner", () => {
        it("should fail", async () => {
            try {
                await closeLongPositionWithIncorrectOwner(ctx);
                assert.ok(false);
            } catch (err) {
                console.error(err);
                assert.ok(/owner constraint/.test(err.toString()) || /6000/.test(err.toString()));
            }
        });
    });

    describe("without a swap co-signer", () => {
        it("should fail", async () => {
            try {
                await closeLongPositionWithoutCosigner(ctx);
                assert.ok(false);
            } catch (err) {
                if (err instanceof AnchorError) {
                    assert.equal(err.error.errorCode.number, 6008);
                } else if (err instanceof ProgramError) {
                    assert.equal(err.code, 6008);
                } else {
                    console.log(err);
                    assert.ok(false);
                }
            }
        });
    });
    
    describe("with correct parameters", () => {
        it("should correctly close the position", async () => {
            try {
                await validateCloseLongPosition(ctx, defaultCloseLongPositionArgs);
            } catch (err) {
                console.error(err);
                assert.ok(false);
            }
        });
    });
    
    describe("with bad debt", () => {
        it("should handle bad debt scenario", async () => {
            try {
                await closeLongPositionWithBadDebt(ctx, defaultCloseLongPositionArgs);
                // If we reach here, the bad debt was handled correctly
                assert.ok(true);
            } catch (err) {
                console.error(err);
                assert.ok(false, "Bad debt scenario should be handled gracefully");
            }
        });
    });
});
