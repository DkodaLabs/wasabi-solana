import { assert } from "chai";
import { validateDeposit } from "./validateStrategy";
import { StrategyContext } from "./strategyContext";

describe("StrategyDeposit", () => {
    let ctx: StrategyContext;
    before(async () => {
        ctx = await new StrategyContext().generate();
    });
    describe("correct setup with an equal amount sent and received", () => {
        it("should deposit into the strategy", async () => {
            try {
                await validateDeposit(ctx, { amountIn: 1_000, amountOut: 1_000 });
            } catch (err) {
                console.error(err);
                assert.ok(false);
            }
        })
    });
    describe("when a second is made", () => {
        it("should correctly increment the borrowed values of the strategy and lp vault", async () => {
            try {
                await validateDeposit(ctx, { amountIn: 1_000, amountOut: 1_000 });
            } catch (err) {
                console.error(err);
                assert.ok(false);
            }
        });
    });
});
