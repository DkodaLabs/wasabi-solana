import {validateInitPool} from "./validatePool";
import {PoolContext} from "./poolContext";

describe("InitMarket", () => {
    let ctx: PoolContext;
    before(async () => {
        ctx = await new PoolContext().generate();
    });

    describe("InitLongPool", () => {
        it("should create the longPool", async () => {
            ctx.isLong = true;
            await validateInitPool(ctx);
        });
    });

    describe("InitShortPool", () => {
        it("should create the shortPool", async () => {
            ctx.isLong = false;
            await validateInitPool(ctx);
        });
    });
})
