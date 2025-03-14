import {LiquidationContext} from "./liquidationContext";
import {
    validateLiquidateLongPosition,
    validateLiquidateShortPosition,
} from './validateLiquidation';
import {
    liquidateShortPositionWithInvalidPermission,
    liquidateShortPositionWithoutExceedingThreshold,
    liquidateLongPositionWithInvalidPermission,
    liquidateLongPositionWithoutExceedingThreshold,
} from './invalidLiquidations'

describe("Liquidations", () => {
    let longCtx: LiquidationContext;
    let shortCtx: LiquidationContext;

    describe("Long position", () => {
        before(async () => {
            longCtx = await new LiquidationContext().generateLongOrderTest();
        });

        describe("without liquidation permission", () => {
            it("should fail", async () => {
                await liquidateLongPositionWithInvalidPermission(longCtx);
            });
        });

        describe("without exceeding liquidation threshold", () => {
            it("should fail", async () => {
                await liquidateLongPositionWithoutExceedingThreshold(longCtx);
            });
        });

        describe("with correct parameters", () => {
            it("should successfully liquidate the position", async () => {
                await validateLiquidateLongPosition(longCtx);
            });
        });
    });

    describe("Short position", () => {
        before(async () => {
            shortCtx = await new LiquidationContext().generateShortOrderTest();
        });

        describe("without liquidation permission", () => {
            it("should fail", async () => {
                await liquidateShortPositionWithInvalidPermission(shortCtx);
            });
        });

        describe("without exceeding liquidation threshold", () => {
            it("should fail", async () => {
                await liquidateShortPositionWithoutExceedingThreshold(shortCtx);
            });
        });

        describe("with correct parameters", () => {
            it("should successfully liquidate the position", async () => {
                await validateLiquidateShortPosition(shortCtx);
            });
        });
    });
});
