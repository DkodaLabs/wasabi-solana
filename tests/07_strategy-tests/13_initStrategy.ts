import {assert} from "chai";
import {StrategyContext} from "./strategyContext";


describe("InitStrategy", () => {
    it("should create the strategy", async () => {
        try {
            await new StrategyContext().generate();
        } catch (err) {
            assert.ok(false);
        }
    })
});
