import { AnchorError, ProgramError } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
    defaultOpenLongPositionArgs,
    validateOpenLongPosition,
    openLongPositionWithInvalidSetup,
    openLongPositionWithoutCleanup,
    openLongPositionWithInvalidPool,
    openLongPositionWithInvalidPosition,
    openLongPositionWithoutCosigner,
} from '../hooks/tradeHook';

describe("OpenLongPosition", () => {
    describe("with more than one setup instruction", () => {
        it("should fail", async () => {
            try {
                await openLongPositionWithInvalidSetup(defaultOpenLongPositionArgs);
                assert.ok(false);
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
                await openLongPositionWithoutCleanup(defaultOpenLongPositionArgs);
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
                    await validateOpenLongPosition({
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
                    await openLongPositionWithInvalidPool(defaultOpenLongPositionArgs);
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
                    await openLongPositionWithInvalidPosition(defaultOpenLongPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    console.error(err);
                    // 'Account already exists'
                    assert.ok(/already in use/.test(err.toString()));
                }
            });
        });
        //NOTE: Come back to this test later
        //
        //describe("without a swap co-signer", () => {
        //    it("should fail", async () => {
        //        try {
        //            await openLongPositionWithoutCosigner(defaultOpenPositionArgs);
        //            assert.ok(false);
        //        } catch (err) {
        //            if (err instanceof AnchorError) {
        //                assert.equal(err.error.errorCode.number, 6008);
        //            } else if (err instanceof ProgramError) {
        //                assert.equal(err.code, 6008);
        //            } else {
        //                console.log(err);
        //                assert.ok(false);
        //            }
        //        }
        //    });
        //});
        describe("correct parameters", () => {
            it("should correctly open a new position", async () => {
                try {
                    await validateOpenLongPosition(defaultOpenLongPositionArgs);
                } catch (err) {
                    console.error(err);
                    assert.ok(false);
                }
            });
        });
    });
});
