import { assert } from "chai";
import { AnchorError, ProgramError } from "@coral-xyz/anchor";
import { TradeContext, defaultOpenShortPositionArgs } from "./tradeContext";
import { validateOpenShortPosition } from "./validateTrade";
import { 
    openShortPositionWithInvalidPool, 
    openShortPositionWithInvalidPosition,
    openShortPositionWithoutCosigner
} from "./invalidTrades";

describe("OpenShortPosition", () => {
    let ctx: TradeContext;

    before(async () => {
        ctx = await new TradeContext().generateShortTest();
    });

    describe("with more than one setup instruction", () => {
        it("should fail", async () => {
            try {
                await ctx.send(await Promise.all([
                    ctx.openShortPositionSetup(defaultOpenShortPositionArgs),
                    ctx.openShortPositionSetup(defaultOpenShortPositionArgs)
                ]));
                assert.ok(false);
            } catch (err) {
                console.error(err);
                // 'Account already exists'
                assert.ok(/already in use/.test(err.toString()));
            }
        });
    });
    
    describe("without a cleanup instruction", () => {
        before(async () => {
            ctx = await new TradeContext().generateShortTest();
        });
        
        it("should fail", async () => {
            try {
                await ctx.send(await Promise.all([
                    ctx.openShortPositionSetup(defaultOpenShortPositionArgs),
                    ctx.createBASwapIx({
                        swapIn: defaultOpenShortPositionArgs.swapIn,
                        swapOut: defaultOpenShortPositionArgs.swapOut,
                        poolAtaA: ctx.shortPoolCurrencyVault,
                        poolAtaB: ctx.shortPoolCollateralVault
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
        before(async () => {
            ctx = await new TradeContext().generateShortTest();
        });
        
        describe("when amount swapped is more than the sum of downpayment + principal", () => {
            it("should fail", async () => {
                try {
                    await validateOpenShortPosition(ctx, {
                        ...defaultOpenShortPositionArgs,
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
                    await openShortPositionWithInvalidPool(ctx, defaultOpenShortPositionArgs);
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
                    await openShortPositionWithInvalidPosition(ctx, defaultOpenShortPositionArgs);
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
                    await openShortPositionWithoutCosigner(ctx, defaultOpenShortPositionArgs);
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
                    await validateOpenShortPosition(ctx, defaultOpenShortPositionArgs);
                } catch (err) {
                    console.error(err);
                    assert.ok(false);
                }
            });
        });
    });
});
