import { assert } from "chai";
import { AnchorError, ProgramError } from "@coral-xyz/anchor";
import { LiquidationContext, defaultLiquidateLongPositionArgs, defaultLiquidateShortPositionArgs } from "./liquidationContext";
import {
    liquidateLongPositionWithInvalidPermission,
    liquidateLongPositionWithoutExceedingThreshold,
    validateLiquidateLongPosition,
    liquidateShortPositionWithInvalidPermission,
    liquidateShortPositionWithoutExceedingThreshold,
    validateLiquidateShortPosition,
} from './validateLiquidation';

describe("Liquidations", () => {
    let longCtx: LiquidationContext;
    let shortCtx: LiquidationContext;

    describe("Long position", () => {
        before(async () => {
            longCtx = await new LiquidationContext().generateLongTestWithDefaultPosition();
        });

        describe("without liquidation permission", () => {
            it("should fail", async () => {
                try {
                    await liquidateLongPositionWithInvalidPermission(longCtx, defaultLiquidateLongPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    console.error(err);
                    if (err instanceof AnchorError) {
                        assert.equal(err.error.errorCode.number, 6000);
                    } else if (err instanceof ProgramError) {
                        assert.equal(err.code, 6000);
                    } else {
                        assert.ok(/Signature verification failed/.test(err.toString()));
                    }
                }
            });
        });

        describe("without exceeding liquidation threshold", () => {
            it("should fail", async () => {
                try {
                    await liquidateLongPositionWithoutExceedingThreshold(longCtx, defaultLiquidateLongPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    console.error(err);
                    if (err instanceof AnchorError) {
                        assert.equal(err.error.errorCode.number, 6012);
                    } else if (err instanceof ProgramError) {
                        assert.equal(err.code, 6012);
                    } else {
                        assert.ok(true);
                    }
                }
            });
        });

        describe("with correct parameters", () => {
            it("should successfully liquidate the position", async () => {
                try {
                    await validateLiquidateLongPosition(longCtx, defaultLiquidateLongPositionArgs);
                    
                    // Verify position is closed
                    const position = await longCtx.program.account.position.fetchNullable(longCtx.longPosition);
                    assert.isNull(position, "Position should be closed");
                    
                    // Verify event was emitted
                    assert.ok(longCtx.liquidationEvent, "Liquidation event should be emitted");
                    assert.equal(
                        longCtx.liquidationEvent.position.toString(),
                        longCtx.longPosition.toString(),
                        "Position ID in event should match"
                    );
                } catch (err) {
                    console.error(err);
                    assert.ok(false);
                }
            });
        });
    });

    describe("Short position", () => {
        let ctx: LiquidationContext;
        
        before(async () => {
            ctx = await new LiquidationContext().generateShortTestWithDefaultPosition();
        });

        describe("without liquidation permission", () => {
            it("should fail", async () => {
                try {
                    await liquidateShortPositionWithInvalidPermission(ctx, defaultLiquidateShortPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    console.error(err);
                    if (err instanceof AnchorError) {
                        assert.equal(err.error.errorCode.number, 6000);
                    } else if (err instanceof ProgramError) {
                        assert.equal(err.code, 6000);
                    } else {
                        assert.ok(/Signature verification failed/.test(err.toString()));
                    }
                }
            });
        });

        describe("without exceeding liquidation threshold", () => {
            it("should fail", async () => {
                try {
                    await liquidateShortPositionWithoutExceedingThreshold(ctx, defaultLiquidateShortPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    console.error(err);
                    if (err instanceof AnchorError) {
                        assert.equal(err.error.errorCode.number, 6012);
                    } else if (err instanceof ProgramError) {
                        assert.equal(err.code, 6012);
                    } else {
                        assert.ok(true);
                    }
                }
            });
        });

        describe("with correct parameters", () => {
            it("should successfully liquidate the position", async () => {
                try {
                    await validateLiquidateShortPosition(ctx, defaultLiquidateShortPositionArgs);
                    
                    // Verify position is closed
                    const position = await ctx.program.account.position.fetchNullable(ctx.shortPosition);
                    assert.isNull(position, "Position should be closed");
                    
                    // Verify event was emitted
                    assert.ok(ctx.liquidationEvent, "Liquidation event should be emitted");
                    assert.equal(
                        ctx.liquidationEvent.position.toString(),
                        ctx.shortPosition.toString(),
                        "Position ID in event should match"
                    );
                } catch (err) {
                    console.error(err);
                    assert.ok(false);
                }
            });
        });
    });
});
