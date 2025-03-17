import {OpenPositionArgs, TradeContext} from "../04_trade-tests/tradeContext";

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

export class EditPositionContext extends TradeContext {
    increasePositionListener: number;
    //decreasePositionListener: number;

    increasePositionEvent;

    //decreasePositionEvent;

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
}
