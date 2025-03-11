import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { StrategyContext } from './strategyContext';
describe("CloseStrategy", () => {
    let ctx: StrategyContext;

    describe("when there is collateral remaining in the vault", () => {
        before(async () => {
            ctx = await new StrategyContext().generateWithdrawTestDefault()
        });

        it("should fail", async () => {
            try {
                await ctx.closeStrategy();
            } catch (err) {
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6036);
                } else {
                    assert.ok(false);
                }
            }
        });
    })

    describe("when there is no collateral remaining in the vault", () => {
        before(async () => {
            await ctx.strategyWithdraw({ amountIn: 800, amountOut: 1000 });
            // ctx = await new StrategyContext().generateWithInitialDeposit({ amountIn: 0, amountOut: 0 });
        });

        it("should successfully close the strategy", async () => {
            try {
                await ctx.closeStrategy();
                assert.ok(true);
            } catch (err) {
                console.error(err);
                assert.ok(false);
            }
        });
    })
});
