import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import {
    validate,
    strategyWithdraw,
    validateWithdraw,
    StrategyContext
} from "../hooks/strategyHook";

describe("StrategyWithdraw", () => {
    let ctx: StrategyContext;

    describe("an equal amount sent and received and no interest accrued", () => {
        describe("partial withdraw", () => {
            before(async () => {
                ctx = await new StrategyContext().generateWithdrawTestDefault()
            });

            it("should withdraw a partial amount and update strategy/lp_vault accounts", async () => {
                await validateWithdraw(ctx, {
                    amountIn: 500,
                    amountOut: 500
                });
            });
        });

        describe("full withdraw", () => {
            before(async () => {
                ctx = await new StrategyContext().generateWithdrawTestDefault()
            });

            it("should withdraw the full amount and update strategy/lp_vault accounts", async () => {
                await validateWithdraw(ctx, {
                    amountIn: 1000,
                    amountOut: 1000
                });
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
                        await validate(ctx, strategyWithdraw, {
                            amountIn: 1000,
                            amountOut: 1100
                        });
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
                        await validate(ctx, strategyWithdraw, {
                            amountIn: 1000,
                            amountOut: 500
                        });
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
                        await validate(ctx, strategyWithdraw, {
                            amountIn: 500,
                            amountOut: 600
                        });
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
                        await validate(ctx, strategyWithdraw, {
                            amountIn: 500,
                            amountOut: 400
                        });
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
                        await validate(ctx, strategyWithdraw, {
                            amountIn: 1000,
                            amountOut: 1005
                        });
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
                        await validate(ctx, strategyWithdraw, {
                            amountIn: 1000,
                            amountOut: 995
                        });
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
                        await validate(ctx, strategyWithdraw, {
                            amountIn: 723,
                            amountOut: 729,
                        });
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
                        await validate(ctx, strategyWithdraw, {
                            amountIn: 724,
                            amountOut: 719
                        });
                    } catch (err) {
                        console.error(err);
                        assert.ok(false);
                    }
                });
            });
        });
    });
});
