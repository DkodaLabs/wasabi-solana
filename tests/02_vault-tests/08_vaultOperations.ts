import {
  validateDeposit,
  validateWithdraw,
  validateDonate,
} from "./validateVault";
import { VaultContext } from "./vaultContext";

describe("Vault Operations", () => {
  let ctx: VaultContext;
  describe("Deposit", () => {
    before(async () => {
      ctx = await new VaultContext().generate();
    });

    it("should have a successful initial deposit", async () => {
      await validateDeposit(ctx, BigInt(1_000_000));
    });

    it("should have a successful second deposit", async () => {
      await validateDeposit(ctx, BigInt(500_000));
    });

    it("should handle deposits near u64 max", async () => {
      await validateDeposit(ctx, BigInt("18446744073709551615")); // u64::MAX
    });

    it("should maintain correct share ratio even with tiny deposits", async () => {
      await validateDeposit(ctx, BigInt(1));
    });
  });

  describe("Withdraw", () => {
    it("should successfully withdraw", async () => {
      await validateWithdraw(ctx, BigInt(1_000_000));
    });
  });

  describe("Donate", () => {
    it("Should allow donation of assets", async () => {
      await validateDonate(ctx, BigInt(1_000_000));
    });
  });
});
