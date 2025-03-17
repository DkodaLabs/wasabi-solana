import { EditPositionContext } from "./editPositionContext";
import { increasePositionWithIncorrectUser } from "./invalidPositionEdits";
import { validateIncreasePosition} from "./validatePositionEditing";

describe("Increase Position", () => {
    let longCtx: EditPositionContext;
    let shortCtx: EditPositionContext;

    describe("increase size on long position", () => {
        before(async () => {
            longCtx = await new EditPositionContext().generateEditPositionLongTest();
        });

        it("should fail when an invalid user attempts to increase position size", async () => {
            await increasePositionWithIncorrectUser(longCtx);
        });

        it('should increase the long position\'s size', async () => {
            await validateIncreasePosition(longCtx);
        });
    });

    describe('increase size on short position', () => {
       before(async () => {
           shortCtx = await new EditPositionContext().generateEditPositionShortTest();
       });

       it("should fail when an invalid user attempts to increase position size", async () => {
           await increasePositionWithIncorrectUser(shortCtx);
       });

       it('should increase the short position\'s size', async () => {
           await validateIncreasePosition(shortCtx);
       });
    });
});
