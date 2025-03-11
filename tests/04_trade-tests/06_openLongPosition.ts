import { assert } from "chai";
import { TradeContext, defaultOpenLongPositionArgs } from "./tradeContext";
import { validateOpenLongPosition } from "./validateTrade";
import { openLongPositionWithInvalidPool, openLongPositionWithInvalidPosition } from "./invalidTrades";

describe("OpenLongPosition", () => {
    let ctx: TradeContext;

    describe("with more than one setup instruction", () => {
        before(async () => {
            ctx = await new TradeContext().generateLongTest();
        });

        it("should fail", async () => {
            try {
                await ctx.send(await Promise.all([
                    ctx.openLongPositionSetup(),
                    ctx.openLongPositionSetup()
                ]));
            } catch (err) {
                console.error(err);
                // 'Account already exists'
                assert.ok(/already in use/.test(err.toString()));
            }
        });
    });
    describe("without a cleanup instruction", () => {
        it("should fail", async () => {
            try {
                await ctx.send(await Promise.all([
                    ctx.openLongPositionSetup(),
                    ctx.createABSwapIx({
                        swapIn: defaultOpenLongPositionArgs.swapIn,
                        swapOut: defaultOpenLongPositionArgs.swapOut,
                        poolAtaA: ctx.longPoolCurrencyVault,
                        poolAtaB: ctx.longPoolCollateralVault
                    })]).then(ixes => ixes.flatMap(ix => ix)));
                assert.ok(false);
            } catch (err) {
                console.error(err);
                // 'Missing cleanup'
                assert.ok(/6002/.test(err.toString()))
            }
        });
    });
    describe("with one setup and one cleanup ix", () => {
        describe("when amount swapped is more than the sum of downpayment + principal", () => {
            it("should fail", async () => {
                try {
                    await validateOpenLongPosition(ctx, {
                        ...defaultOpenLongPositionArgs,
                        swapIn: BigInt(3_000),
                    });
                    assert.ok(false);
                } catch (err) {
                    console.error(err);
                    // 'Insufficient funds'
                    assert.ok(/insufficient funds/.test(err.toString()));
                }
            });
        });
        describe("with a different pool in the cleanup instruction", () => {
            it("should fail", async () => {
                try {
                    await openLongPositionWithInvalidPool(ctx);
                    assert.ok(false);
                } catch (err) {
                    console.error(err);
                    // 'Invalid pool'
                    assert.ok(/6006/.test(err.toString()));
                }
            });
        });
        describe("with an incorrect position", () => {
            it("should fail", async () => {
                try {
                    await openLongPositionWithInvalidPosition(ctx);
                    assert.ok(false);
                } catch (err) {
                    console.error(err);
                    // 'Account already exists'
                    assert.ok(/already in use/.test(err.toString()));
                }
            });
        });

        describe("without a swap co-signer", () => {
            it("should fail", async () => {
                try {
                    await openLongPositionWithoutCosigner(ctx);
                    assert.ok(false);
                } catch (err) {
                    if (err instanceof AnchorError) {
                        assert.equal(err.error.errorCode.number, 6008);
                    } else if (err instanceof ProgramError) {
                        assert.equal(err.code, 6008);
                    } else {
                        console.log(err);
                        assert.ok(false);
                    }
                }
            });
        });
        describe("correct parameters", () => {
            it("should correctly open a new position", async () => {
                try {
                    await validateOpenLongPosition(ctx, defaultOpenLongPositionArgs);
                } catch (err) {
                    console.error(err);
                    assert.ok(false);
                }
            });
        });
    });
});
