import { setupTestEnvironment } from './rootHook'
import { initWasabi } from './initWasabi';
import { initPools } from './poolHook';
import {
    openLongPosition,
    openShortPosition,
    defaultOpenLongPositionArgs,
    defaultOpenShortPositionArgs
} from './tradeHook';

export const defaultInitStopLossArgs = {
};

export const defaultInitTakeProfitArgs = {
};

export const defaultExecuteStopLossArgs = {
};

export const defaultExecuteTakeProfitArgs = {
};

export const initStopLossOrder = async () => {
};

export const initTakeProfitOrder = async () => {
};

export const executeStopLossOrder = async () => {
};

export const executeTakeProfitOrder = async () => {
};

export const validateExecuteStopLossOrder = async () => {
};

export const validateExecuteTakeProfitOrder = async () => {
};

export const cancelTakeProfitOrderWithInvalidPermission = async () => {
};

export const cancelTakeProfitOrderWithUser = async () => {
};

export const cancelTakeProfitOrderWithAdmin = async () => {
};

export const executeTakeProfitOrderWithInvalidAuthority = async () => {
};

export const executeTakeProfitOrderWithInvalidTakerAmount = async () => {
};

export const cancelStopLossOrderWithInvalidPermission = async () => {
};

export const cancelStopLossOrderWithUser = async () => {
};

export const cancelStopLossOrderWithAdmin = async () => {
};

export const executeStopLossOrderWithInvalidAuthority = async () => {
};

export const executeStopLossOrderWithInvalidTakerAmount = async () => {
};


export const mochaHooks = {
    beforeAll: async () => {
        await setupTestEnvironment();
        await initWasabi();
        await initPools();
        await openLongPosition(defaultOpenLongPositionArgs);
        await openShortPosition(defaultOpenShortPositionArgs);
    }
}
