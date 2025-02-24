import { assert } from "chai";
import { validateSetup } from "../hooks/strategyHook";

describe("InitStrategy", () => {
    it("should create the strategy", async () => {
        try {
            await validateSetup();
        } catch (err) {
            assert.ok(false);
        }
    })
});
