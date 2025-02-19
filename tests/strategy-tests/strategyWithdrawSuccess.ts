import { assert } from 'chai';
import { setupStrategy, strategyDeposit, validateWithdraw } from '../hooks/strategyHook';

describe("Correct setup with an equal amount sent and received and no interest accrued", () => {
    before(async () => {
        await setupStrategy();
        await strategyDeposit({ amountIn: 1000, amountOut: 1000 });
    });

    describe("Partial withdraw", () => {
        it("should withdraw a partial amount from the strategy and update strategy / lp_vault accounts", async () => {
            await validateWithdraw({ amountIn: 500, amountOut: 500 });
            assert.ok(true);
        });
    });

    describe("Full withdraw", () => {
        it("should withdraw the full amount from the strategy", async () => {
            await strategyDeposit({ amountIn: 500, amountOut: 500 });
            await validateWithdraw({ amountIn: 1000, amountOut: 1000 });
            assert.ok(true)
        });
    });
});
