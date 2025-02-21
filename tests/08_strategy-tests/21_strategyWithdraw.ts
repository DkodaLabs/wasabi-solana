import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import {
    strategyWithdraw,
    strategyDeposit,
    strategyWithdrawClaimBefore,
    strategyWithdrawClaimAfter,
    validateWithdraw,
    StrategyContext
} from "../hooks/strategyHook";

describe("StrategyWithdraw", () => {
    let ctx: StrategyContext;

    describe("an equal amount sent and received and no interest accrued", () => {
        describe("partial withdraw", () => {
            before(async () => {
                ctx = await new StrategyContext().generateWithdrawTestDefault()
                console.log(ctx);
            });

            it("should withdraw a partial amount and update strategy/lp_vault accounts", async () => {
                console.log(ctx);
                await validateWithdraw(ctx, { amountIn: 500, amountOut: 500 });
            });
        });

        describe("full withdraw", () => {
            before(async () => {
                ctx = await new StrategyContext().generateWithdrawTestDefault()
                console.log(ctx);
            });

            it("should withdraw the full amount and update strategy/lp_vault accounts", async () => {
                console.log(ctx);
                await validateWithdraw(ctx, { amountIn: 1000, amountOut: 1000 });
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
                    try {
                        await strategyWithdraw(ctx, { amountIn: 1000, amountOut: 2000 });
                        assert.ok(false);
                    } catch (err) {
                        if (err instanceof anchor.AnchorError) {
                            assert.equal(err.error.errorCode.number, 6016);
                        } else {
                            assert.ok(false);
                        }
                    }
                });
            });
            describe("receiving less than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should fail", async () => {
                    try {
                        await strategyWithdraw(ctx, { amountIn: 1000, amountOut: 500 });
                        assert.ok(false);
                    } catch (err) {
                        if (err instanceof anchor.AnchorError) {
                            assert.equal(err.error.errorCode.number, 6016);
                        } else {
                            assert.ok(false);
                        }
                    }
                });
            });
        });
        describe("partial withdraw", () => {
            describe("receiving more than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should fail", async () => {
                    try {
                        await strategyWithdraw(ctx, { amountIn: 500, amountOut: 600 });
                        assert.ok(false);
                    } catch (err) {
                        if (err instanceof anchor.AnchorError) {
                            assert.equal(err.error.errorCode.number, 6016);
                        } else {
                            assert.ok(false);
                        }
                    }
                });
            });
            describe("receiving less than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should fail", async () => {
                    try {
                        await strategyWithdraw(ctx, { amountIn: 500, amountOut: 400 });
                        assert.ok(false);
                    } catch (err) {
                        if (err instanceof anchor.AnchorError) {
                            assert.equal(err.error.errorCode.number, 6016);
                        } else {
                            assert.ok(false);
                        }
                    }
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
                    try {
                        await strategyWithdraw(ctx, { amountIn: 1000, amountOut: 1005 });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            })
            describe("receiving less than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should succeed", async () => {
                    try {
                        await strategyWithdraw(ctx, { amountIn: 1000, amountOut: 995 });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            });
        });
        describe("partial withdraw", () => {
            describe("receiving more than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should succeed", async () => {
                    try {
                        await strategyWithdraw(ctx, { amountIn: 500, amountOut: 501 });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            })
            describe("receiving less than expected", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should succeed", async () => {
                    try {
                        await strategyWithdraw(ctx, { amountIn: 500, amountOut: 499 });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            });
        });
    });

    // setup, CLAIM, swap, cleanup
    describe("when there is a realized difference before the 'swap' occurs", () => {
        describe("full withdraw", () => {
            describe("interest has accrued", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should correctly adjust the amounts in the cleanup", async () => {
                    try {
                        await strategyWithdrawClaimBefore(ctx, { amountIn: 1000, amountOut: 1005, newQuote: 1008 });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            });
            describe("interest has been lost", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should correctly adjust the amounts in the cleanup", async () => {
                    try {
                        await strategyWithdrawClaimBefore(ctx, { amountIn: 1000, amountOut: 995, newQuote: 993 });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            });
        });
        describe("partial withdraw", () => {
            describe("interest has accrued", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should correctly adjust the amounts in the cleanup", async () => {
                    try {
                        await strategyWithdrawClaimBefore(ctx, { amountIn: 500, amountOut: 501, newQuote: 1005 });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            });
            describe("interest has been lost", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should correctly adjust the amounts in the cleanup", async () => {
                    try {
                        await strategyWithdrawClaimBefore(ctx, { amountIn: 500, amountOut: 499, newQuote: 995 });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            });
        });
    });

    // setup, swap, CLAIM, cleanup
    describe("when there is a realized difference after the 'swap' occurs", () => {
        describe("full withdraw", () => {
            describe("interest has accrued", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should correctly adjust the amounts in the cleanup", async () => {
                    try {
                        await strategyWithdrawClaimAfter(ctx, { amountIn: 1000, amountOut: 1005, newQuote: 1008 });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            });
            describe("interest has been lost", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should correctly adjust the amounts in the cleanup", async () => {
                    try {
                        await strategyWithdrawClaimAfter(ctx, { amountIn: 1000, amountOut: 995, newQuote: 993 });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            });
        });
        describe("partial withdraw", () => {
            describe("interest has accrued", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                    await strategyDeposit(ctx, { amountIn: 1000, amountOut: 1000 });
                });

                it("should correctly adjust the amounts in the cleanup", async () => {
                    try {
                        await strategyWithdrawClaimAfter(ctx, { amountIn: 500, amountOut: 501, newQuote: 1005 });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            });
            describe("interest has been lost", () => {
                before(async () => {
                    ctx = await new StrategyContext().generateWithdrawTestDefault();
                });

                it("should correctly adjust the amounts in the cleanup", async () => {
                    try {
                        await strategyWithdrawClaimAfter(ctx, { amountIn: 500, amountOut: 499, newQuote: 995 });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            });
        });
    });
});
