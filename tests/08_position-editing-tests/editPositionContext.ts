import {ClosePositionArgs, OpenPositionArgs, TradeContext} from "../04_trade-tests/tradeContext";

export const defaultIncreaseLongPositionArgs = <OpenPositionArgs>{
    minOut:       BigInt(900),
    downPayment:  BigInt(500),
    principal:    BigInt(500),
    fee:          BigInt(10),
    swapIn:       BigInt(1_000),
    swapOut:      BigInt(900),
};

export const defaultIncreaseShortPositionArgs = <OpenPositionArgs>{
    minOut:      BigInt(500),
    downPayment: BigInt(50),
    principal:   BigInt(50),
    fee:         BigInt(10),
    swapIn:      BigInt(50),
    swapOut:     BigInt(500)
};

export const defaultDecreaseLongPositionArgs = <ClosePositionArgs>{
    minOut:       BigInt(0),
    interest:     BigInt(1),
    executionFee: BigInt(11),
    expiration:   BigInt(Math.floor(Date.now() / 1_000 + 60 * 60)),
    swapIn:       BigInt(1_900),
    swapOut:      BigInt(2_000),
}

export const defaultDecreaseShortPositionArgs = <ClosePositionArgs>{
    minOut:       BigInt(0),
    interest:     BigInt(1),
    executionFee: BigInt(10),
    expiration:   BigInt(Math.floor(Date.now() / 1_000 + 60 * 60)),
    swapIn:       BigInt(100),
    swapOut:      BigInt(1_001),
}

export class EditPositionContext extends TradeContext {
    increasePositionListener: number;
    decreasePositionListener: number;

    increasePositionEvent;

    decreasePositionEvent;

    constructor() {
        super();
    }

    async generateEditPositionLongTest(): Promise<EditPositionContext> {
        await this.generateLongTestWithDefaultPosition();
        return await this.generateEditPositionContext();
    }

    async generateEditPositionShortTest(): Promise<EditPositionContext> {
        await this.generateShortTestWithDefaultPosition();
        return await this.generateEditPositionContext();
    }

    async generateEditPositionContext(): Promise<EditPositionContext> {
        this.increasePositionListener = this.program.addEventListener("positionIncreased", (event) => {
            this.increasePositionEvent = event
        });

        return this;
    }

    async increaseLongPosition({
        minOut,
        downPayment,
        principal,
        fee,
        swapIn,
        swapOut,
    }: OpenPositionArgs) {
        return await this.openLongPosition({
            minOut,
            downPayment,
            principal,
            fee,
            swapIn,
            swapOut,
        });
    }

    async increaseShortPosition({
        minOut,
        downPayment,
        principal,
        fee,
        swapIn,
        swapOut,
    }: OpenPositionArgs) {
        return await this.openShortPosition({
            minOut,
            downPayment,
            principal,
            fee,
            swapIn,
            swapOut,
        });
    }

    async decreaseLongPosition({
        minOut,
        interest,
        executionFee,
        swapIn,
        swapOut,
    }: ClosePositionArgs) {
        return await this.closeLongPosition({
            minOut,
            interest,
            executionFee,
            swapIn,
            swapOut
        });
    }

    async decreaseShortPosition({
        minOut,
        interest,
        executionFee,
        swapIn,
        swapOut,
    }: ClosePositionArgs) {
        return await this.closeShortPosition({
            minOut,
            interest,
            executionFee,
            swapIn,
            swapOut
        });
    }
}
