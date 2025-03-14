import * as anchor from "@coral-xyz/anchor";
import {assert} from "chai";
import {StrategyContext} from './strategyContext';

describe("CloseStrategy", () => {
    let ctx: StrategyContext;

    describe("when there is collateral remaining in the vault", () => {
        before(async () => {
            ctx = await new StrategyContext().generateWithdrawTestDefault()
        });

        it("should fail", async () => {
            try {
                await ctx.closeStrategy();
                assert.fail("Should have thrown an error");
            } catch (err) {
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6036);
                } else {
                    throw err;
                }
            }
        });
    })

    describe("when there is no collateral remaining in the vault", () => {
        before(async () => {
            await ctx.strategyWithdraw({amountIn: 800, amountOut: 1000});
        });

        it("should successfully close the strategy", async () => {
            await ctx.closeStrategy();
            const strategyAccount = await ctx.program.account.strategy.fetchNullable(ctx.strategy);
            assert.isNull(strategyAccount, "Strategy account should be closed");
        });
    })
});
