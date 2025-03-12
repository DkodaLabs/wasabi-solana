import {assert} from "chai";
import {validateDeposit, validateWithdraw, validateDonate} from '../hooks/vaultHook';

describe("Deposit", () => {
    it("should have a successful initial deposit", async () => {
        await validateDeposit(BigInt(1_000_000));
    });
    it("should have a successful second deposit", async () => {
        await validateDeposit(BigInt(500_000));
    });
    it("should handle deposits near u64 max", async () => {
        await validateDeposit(BigInt("18446744073709551615")); // u64::MAX
    });

    it("should maintain correct share ratio even with tiny deposits", async () => {
        await validateDeposit(BigInt(1));
    });
});

describe("Withdraw", () => {
    it("should successfully withdraw", async () => {
        await validateWithdraw(BigInt(1_000_000));
    });
});

describe("Donate", () => {
    it("Should allow donation of assets", async () => {
        await validateDonate(BigInt(1_000_000));
    });
});
