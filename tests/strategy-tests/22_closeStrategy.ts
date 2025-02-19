import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { closeStrategy, setupStrategy, strategyDeposit, strategyWithdraw } from '../hooks/strategyHook';

describe("CloseStrategy", () => {
    before(async () => {
        await setupStrategy();
        await strategyDeposit({ amountIn: 1000, amountOut: 1000 });
    });

    describe("when there is collateral remaining in the vault", () => {
        it("should fail", async () => {
            try {
                await closeStrategy();
            } catch (err) {
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6036);
                } else {
                    assert.ok(false);
                }
            }
        });
    })

    describe("when there is no collateral remaining in the vault", () => {
        before(async () => {
            strategyWithdraw({ amountIn: 1000, amountOut: 1000 });
        });

        it("should successfully close the strategy", async () => {
            try {
                await closeStrategy();
                assert.ok(true);
            } catch (err) {
                console.error(err);
                assert.ok(false);
            }
        });
    })
});
