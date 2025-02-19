import { assert } from "chai";
import {
    superAdminProgram,
    lpVaultA
} from "../hooks/allHook";
import {
    setupStrategy,
    strategy,
    collateralVault,
    currency,
    collateral,
} from "../hooks/strategyHook";

describe("InitStrategy", () => {
    it("should create the strategy", async () => {
        try {
            await setupStrategy();

            const strategyAccount = await superAdminProgram.account.strategy.fetch(strategy);

            assert(strategyAccount.collateralVault.equals(collateralVault));
            assert(strategyAccount.currency.equals(currency));
            assert(strategyAccount.collateral.equals(collateral));
            assert(strategyAccount.lpVault.equals(lpVaultA));
        } catch (err) {
            assert.ok(false);
        }
    })
});
