import {setupTestEnvironment} from './rootHook';
import {initWasabi} from './initWasabi';

export const mochaHooks = {
    beforeAll: async () => {
        await setupTestEnvironment();
        await initWasabi();
    },
}
