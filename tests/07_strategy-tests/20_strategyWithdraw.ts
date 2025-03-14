import {assert} from "chai";
import {
    validateWithdraw,
} from "./validateStrategy";
import {StrategyContext} from './strategyContext';

describe("StrategyWithdraw", () => {
    let ctx: StrategyContext;

    describe("an equal amount sent and received and no interest accrued", () => {
        describe("partial withdraw", () => {
            before(async () => {
                ctx = await new StrategyContext().generateWithdrawTestDefault()
            });

            it("should withdraw a partial amount and update strategy/lp_vault accounts", async () => {
                await validateWithdraw(ctx, {amountIn: 400, amountOut: 500});
            });
        });

        describe("full withdraw", () => {
            before(async () => {
                ctx = await new StrategyContext().generateWithdrawTestDefault()
            });

            it("should withdraw the full amount and update strategy/lp_vault accounts", async () => {
                await validateWithdraw(ctx, {amountIn: 800, amountOut: 1000});
            });
        });
    });

    describe("when interest deviates more than the threshold (1%)", () => {
        describe("full withdraw", () => {
            describe("receiving more than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should fail", async () => {
                    await validateWithdraw(ctx, {amountIn: 800, amountOut: 1100});
                });
            });
            describe("receiving less than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should fail", async () => {
                    await validateWithdraw(ctx, {amountIn: 800, amountOut: 500});
                });
            });
        });
        describe("partial withdraw", () => {
            describe("receiving more than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should fail", async () => {
                    await validateWithdraw(ctx, {amountIn: 400, amountOut: 600});
                });
            });
            describe("receiving less than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should fail", async () => {
                    await validateWithdraw(ctx, {amountIn: 300, amountOut: 400});
                });
            });
        });
    });

    describe("when interest deviates less than the threshold (1%)", () => {
        describe("full withdraw", () => {
            describe("receiving more than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should succeed", async () => {
                    await validateWithdraw(ctx, {amountIn: 800, amountOut: 1009});
                });
            })
            describe("receiving less than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should succeed", async () => {
                    await validateWithdraw(ctx, {amountIn: 800, amountOut: 992});
                });
            });
        });
        describe("partial withdraw", () => {
            describe("receiving more than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should succeed", async () => {
                    await validateWithdraw(ctx, {amountIn: 523, amountOut: 655});
                });
            })
            describe("receiving less than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should succeed", async () => {
                    await validateWithdraw(ctx, {amountIn: 524, amountOut: 656});
                });
            });
        });
    });
});
