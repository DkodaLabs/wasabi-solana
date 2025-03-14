import {OrderContext} from "./orderContext";
import {
    validateInitTakeProfitOrder,
    validateExecuteTakeProfitOrder,
    cancelTakeProfitOrderWithInvalidPermission,
    cancelTakeProfitOrderWithUser,
    cancelTakeProfitOrderWithAdmin,
    executeTakeProfitOrderWithInvalidAuthority,
    executeTakeProfitOrderWithInvalidTakerAmount
} from './validateOrder';

describe("TakeProfit", () => {
    let longCtx: OrderContext;
    let shortCtx: OrderContext;

    describe("Long position", () => {
        before(async () => {
            longCtx = await new OrderContext().generateLongOrderTest();
        });

        it("should init the TP order", async () => {
            await validateInitTakeProfitOrder(longCtx);
        });

        it("should fail to close the TP order without proper permissions", async () => {
            await cancelTakeProfitOrderWithInvalidPermission(longCtx);
        });

        it("should close the TP order when invoked by the user", async () => {
            await cancelTakeProfitOrderWithUser(longCtx);
        });

        it("should close the TP order when invoked by the admin", async () => {
            await cancelTakeProfitOrderWithAdmin(longCtx);
        });

        it("should fail when the authority cannot co-sign swaps", async () => {
            await executeTakeProfitOrderWithInvalidAuthority(longCtx);
        });

        it("should fail when the TP taker amount is exceeded", async () => {
            await executeTakeProfitOrderWithInvalidTakerAmount(longCtx);
        });

        it("should execute TP order", async () => {
            await validateExecuteTakeProfitOrder(longCtx);
        });
    });

    describe("Short position", () => {
        before(async () => {
            shortCtx = await new OrderContext().generateShortOrderTest();
        });

        it("should init the TP order", async () => {
            await validateInitTakeProfitOrder(shortCtx);
        });

        it("should fail to close the TP order without proper permissions", async () => {
            await cancelTakeProfitOrderWithInvalidPermission(shortCtx);
        });

        it("should close the TP order when invoked by the user", async () => {
            await cancelTakeProfitOrderWithUser(shortCtx);
        });

        it("should close the TP order when invoked by the admin", async () => {
            await cancelTakeProfitOrderWithAdmin(shortCtx);
        });

        it("should fail when the authority cannot co-sign swaps", async () => {
            await executeTakeProfitOrderWithInvalidAuthority(shortCtx);
        });

        it("should fail when the TP taker amount is exceeded", async () => {
            await executeTakeProfitOrderWithInvalidTakerAmount(shortCtx);
        });

        it("should execute TP order", async () => {
            await validateExecuteTakeProfitOrder(shortCtx);
        });
    });
});
