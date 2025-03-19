import { EditPositionContext } from "./editPositionContext";
import { decreasePositionWithIncorrectUser } from "./invalidPositionEdits";
import { validateDecreasePosition} from "./validatePositionEditing";

describe("decrease Position", () => {
    let longCtx: EditPositionContext;
    let shortCtx: EditPositionContext;

    describe("decrease size on long position", () => {
        before(async () => {
            longCtx = await new EditPositionContext().generateEditPositionLongTest();
        });

        it("should fail when an invalid user attempts to decrease position size", async () => {
            await decreasePositionWithIncorrectUser(longCtx);
        });

        it('should decrease the long position\'s size', async () => {
            await validateDecreasePosition(longCtx);
        });
    });

    describe('decrease size on short position', () => {
        before(async () => {
            shortCtx = await new EditPositionContext().generateEditPositionShortTest();
        });

        it("should fail when an invalid user attempts to decrease position size", async () => {
            await decreasePositionWithIncorrectUser(shortCtx);
        });

        it('should decrease the short position\'s size', async () => {
            await validateDecreasePosition(shortCtx);
        });
    });
});
