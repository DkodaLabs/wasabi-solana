import { assert } from "chai";
import { AnchorError, ProgramError } from "@coral-xyz/anchor";
import { TradeContext, defaultCloseShortPositionArgs } from './tradeContext';
import {
    closeShortPositionWithIncorrectOwner,
    closeShortPositionWithoutCosigner,
    closeShortPositionWithInvalidSetup,
    closeShortPositionWithoutCleanup,
} from './invalidTrades';

describe("CloseShortPosition", () => {
    let ctx: TradeContext;

    before(async () => {
        ctx = await new TradeContext().generateShortTestWithDefaultPosition();
        ctx.isCloseTest = true;
    });

    describe("with more than one setup instruction", () => {
        it("should fail", async () => {
            try {
                await closeShortPositionWithInvalidSetup(ctx);
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
                await closeShortPositionWithoutCleanup(ctx);
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
                await closeShortPositionWithIncorrectOwner(ctx);
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
                await closeShortPositionWithoutCosigner(ctx);
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
                await ctx.closeShortPosition(defaultCloseShortPositionArgs);
                
                // Verify position is closed
                const position = await ctx.program.account.position.fetchNullable(ctx.shortPosition);
                assert.isNull(position, "Position should be closed");
                
                // Verify event was emitted
                assert.ok(ctx.closePositionEvent, "Close position event should be emitted");
                assert.equal(
                    ctx.closePositionEvent.id.toString(),
                    ctx.shortPosition.toString(),
                    "Position ID in event should match"
                );
                assert.equal(
                    ctx.closePositionEvent.trader.toString(),
                    ctx.program.provider.publicKey.toString(),
                    "Trader in event should match"
                );
            } catch (err) {
                console.error(err);
                assert.ok(false);
            }
        });
    });
});
