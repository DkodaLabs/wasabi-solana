import {OrderContext} from "./orderContext";
import {
    initStopLossOrder,
    validateExecuteStopLossOrder,
    cancelStopLossOrderWithInvalidPermission,
    cancelStopLossOrderWithUser,
    cancelStopLossOrderWithAdmin,
    executeStopLossOrderWithInvalidAuthority,
    executeStopLossOrderWithInvalidTakerAmount
} from './validateOrder';

describe("StopLoss", () => {
    let longCtx: OrderContext;
    let shortCtx: OrderContext;

    describe("Long position", () => {
        before(async () => {
            longCtx = await new OrderContext().generateLongOrderTest();
        });

        it("should init the SL order", async () => {
            await initStopLossOrder(longCtx);
        });

        it("should fail to close the SL order without proper permissions", async () => {
            await cancelStopLossOrderWithInvalidPermission(longCtx);
        });

        it("should close the SL order when invoked by the user", async () => {
            await cancelStopLossOrderWithUser(longCtx);
        });

        it("should close the SL order when invoked by the admin", async () => {
            await cancelStopLossOrderWithAdmin(longCtx);
        });

        it("should fail when the authority cannot co-sign swaps", async () => {
            await executeStopLossOrderWithInvalidAuthority(longCtx);
        });

        it("should fail when the SL taker amount is exceeded", async () => {
            await executeStopLossOrderWithInvalidTakerAmount(longCtx);
        });

        it("should execute SL order", async () => {
            await validateExecuteStopLossOrder(longCtx);
        });
    });

    describe("Short position", () => {
        before(async () => {
            shortCtx = await new OrderContext().generateShortOrderTest();
        });

        it("should init the SL order", async () => {
            await initStopLossOrder(shortCtx);
        });

        it("should fail to close the SL order without proper permissions", async () => {
            await cancelStopLossOrderWithInvalidPermission(shortCtx);
        });

        it("should close the SL order when invoked by the user", async () => {
            await cancelStopLossOrderWithUser(shortCtx);
        });

        it("should close the SL order when invoked by the admin", async () => {
            await cancelStopLossOrderWithAdmin(shortCtx);
        });

        it("should fail when the authority cannot co-sign swaps", async () => {
            await executeStopLossOrderWithInvalidAuthority(shortCtx);
        });

        it("should fail when the SL taker amount is exceeded", async () => {
            await executeStopLossOrderWithInvalidTakerAmount(shortCtx);
        });

        it("should execute SL order", async () => {
            await validateExecuteStopLossOrder(shortCtx);
        });
    });
});