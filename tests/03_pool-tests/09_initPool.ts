import { validateInitPool } from "../hooks/poolHook";

describe("InitLongPool", () => {
    it("should create the longPool", async () => {
        await validateInitPool(true);
    });
});

describe("InitShortPool", () => {
    it("should create the shortPool", async () => {
        await validateInitPool(false);
    });
});
