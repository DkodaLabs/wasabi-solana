import { assert } from "chai";
import { validateDeposit, validateWithdraw, validateDonate } from '../hooks/vaultHook';

describe("Deposit", () => {
    it("should have a successful initial deposit", async () => {
        try {
            await validateDeposit(BigInt(1_000_000));
        } catch (err) {
            console.error(err);
            assert.ok(false);
        }
    });
    it("should have a successful second deposit", async () => {
        try {
            await validateDeposit(BigInt(500_000));
        } catch (err) {
            console.error(err);
            assert.ok(false);
        }
    });
    it("should handle deposits near u64 max", async () => {
        try {
            await validateDeposit(BigInt("18446744073709551615")); // u64::MAX
            assert.fail("Should have thrown error");
        } catch (e) {
            assert.include(e.message, "insufficient funds");
        }
    });

    it("should maintain correct share ratio even with tiny deposits", async () => {
        try {
            await validateDeposit(BigInt(1));
        } catch (err) {
            console.error(err);
            assert.ok(false);
        }
    });
});

describe("Withdraw", () => {
    it("should successfully withdraw", async () => {
        try {
            await validateWithdraw(BigInt(1_000_000));
        } catch (error) {
            console.error(error);
            assert.ok(false);
        }
    });
});

describe("Donate", () => {
    it("Should allow donation of assets", async () => {
        try {
            await validateDonate(BigInt(1_000_000));
        } catch (err) {
            console.error(err);
            assert.ok(false);
        }
    });
});
