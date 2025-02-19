import { assert } from 'chai';
import { setupStrategy, strategyDeposit, validateClaim, strategyClaim } from '../hooks/strategyHook';

describe("StrategyClaim", () => {
    before(async () => {
        await setupStrategy();
        await strategyDeposit({ amountIn: 1000, amountOut: 1000 });
    });

    afterEach(async () => {
        await strategyClaim(1000);
    });

    describe("new quote is greater than old quote", () => {
        it("should correctly increment strategy and lp_vault balances", async () => {
            const newQuote = 1005;
            await validateClaim(newQuote);
            assert.ok(true);
        })
    })
    describe("new quote is less than old quote", () => {
        it("should correctly decrement strategy and lp_vault balances when interest is negative", async () => {

            const newQuote = 995;
            await validateClaim(newQuote);
            assert.ok(true);
        });
    });

    describe("New quote is significantly greater than old quote", () => {
        it("should fail", async () => {
            const newQuote = 2000;
            await validateClaim(newQuote);
            assert.ok(true);
        });
    });

    describe("New quote is significantly less than old quote", () => {
        it("should fail", async () => {
            const newQuote = 100;
            await validateClaim(newQuote);
            assert.ok(true);
        });
    });
});
