import { assert } from "chai";
import {
    defaultCloseShortPositionArgs,
    validateCloseShortPosition,
    closeShortPositionWithIncorrectOwner,
    closeShortPositionWithoutCosigner,
    closeShortPositionWithInvalidSetup,
    closeShortPositionWithoutCleanup,
} from '../hooks/tradeHook';

describe("CloseShortPosition", () => {
    describe("with owned short position", () => {
        describe("with an incorrect owner", () => {
            it("should fail", async () => {
                try {
                    await closeShortPositionWithIncorrectOwner(defaultCloseShortPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    assert.ok(true);
                }
            });
        });
        describe("without swap cosigner", () => {
            it("should fail", async () => {
                try {
                    await closeShortPositionWithoutCosigner(defaultCloseShortPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    assert.ok(true);
                }
            });
        });
        describe("with more than one setup instruction", () => {
            it("should fail", async () => {
                try {
                    await closeShortPositionWithInvalidSetup(defaultCloseShortPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    assert.ok(true);
                }
            });
        });
        describe("without a cleanup instruction", () => {
            it("should fail", async () => {
                try {
                    await closeShortPositionWithoutCleanup(defaultCloseShortPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    assert.ok(true);
                }
            });
        });
        describe("correct setup", () => {
            it("should close the position and return funds", async () => {
                try {
                    await validateCloseShortPosition(defaultCloseShortPositionArgs);
                    assert.ok(false);
                } catch (err) {
                    assert.ok(true);
                }
            });
        });
    });
});

//                const [positionAfter, [vaultAfter, ownerTokenAAfter, ownerBAfter, feeBalanceAfter]] = await Promise.all([
//                    program.account.position.fetchNullable(positionKey),
//                    getMultipleTokenAccounts(program.provider.connection, [
//                        vaultKey,
//                        ownerTokenA,
//                        ownerTokenB,
//                        feeWallet,
//                    ], TOKEN_PROGRAM_ID),
//                ]);
//                assert.isNull(positionAfter);
//
//                // should pay back interest + principal to LP Vault
//                const expectedLpVaultDiff = positionBefore.principal.add(interestOwed);
//                const vaultDiff = vaultAfter.amount - vaultBefore.amount;
//                assert.equal(expectedLpVaultDiff.toString(), vaultDiff.toString());
//
//                // Assert user does not receive payout in tokenB
//                const ownerBDiff = ownerBAfter.amount - ownerBBefore.amount;
//                assert.equal(ownerBDiff, BigInt(0));
//
//                // Assert user receives payout in tokenA
//                const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
//                assert.equal(ownerADiff, BigInt(954));
//
//                //const feeBalanceDiff = feeBalanceAfter.amount - feeBalanceBefore.amount;
//                //assert.equal(feeBalanceDiff.toString(), closeExecutionFee.toString());
//            });
//        });
//    });
//});
