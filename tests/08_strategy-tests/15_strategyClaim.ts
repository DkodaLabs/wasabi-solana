import { validateClaim } from './validateStrategy';
import { StrategyContext } from './strategyContext';

describe("StrategyClaim", () => {
    let ctx: StrategyContext;

    describe("new quote is greater than old quote", () => {
        before(async () => {
            ctx = await new StrategyContext().generateWithdrawTestDefault();
        });
        it("should correctly increment strategy and lp_vault balances", async () => {
            const newQuote = 1005;
            await validateClaim(ctx, newQuote);
        })
    })
    describe("new quote is less than old quote", () => {
        it("should correctly decrement strategy and lp_vault balances when interest is negative", async () => {

            const newQuote = 995;
            await validateClaim(ctx, newQuote);
        });
    });

    describe("New quote is significantly greater than old quote", () => {
        it("should fail", async () => {
            const newQuote = 2000;
            await validateClaim(ctx, newQuote);
        });
    });

    describe("New quote is significantly less than old quote", () => {
        it("should fail", async () => {
            const newQuote = 100;
            await validateClaim(ctx, newQuote);
        });
    });
});
