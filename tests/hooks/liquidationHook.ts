import { BN, Program, workspace } from '@coral-xyz/anchor';
import { setupTestEnvironment } from './allHook'
import { initWasabi } from './initWasabi';
import { initPools } from './poolHook';
import {
    openLongPosition,
    openShortPosition,
    defaultOpenLongPositionArgs,
    defaultOpenShortPositionArgs,
    createABSwapIx,
    createBASwapIx,
    ClosePositionArgs,
    send,
    sendInvalid,
} from './tradeHook';
import {
    longPoolCollateralAta,
    longPoolCurrencyAta,
    shortPoolCollateralAta,
    shortPoolCurrencyAta,
} from './poolHook';
import { WasabiSolana } from '../../target/types/wasabi_solana';

const program = workspace.WasabiSolana as Program<WasabiSolana>;

export const defaultLiquidateLongPositionArgs = {
    minOut: BigInt(0),
    interest: BigInt(1),
    executionFee: BigInt(11),
    expiration: BigInt(Date.now() / 1_000 + 60 * 60),
    swapIn: BigInt(1_900),
    swapOut: BigInt(2_000),
};
export const defaultLiquidateShortPositionArgs = {
    minOut: BigInt(0),
    interest: BigInt(1),
    executionFee: BigInt(11),
    expiration: BigInt(Date.now() / 1_000 + 60 * 60),
    swapIn: BigInt(1_900),
    swapOut: BigInt(2_000),
};

export const liquidateLongPosition = async ({
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs) => {
    const instructions = await Promise.all([
        liquidateLongPositionSetup({ minOut, interest, executionFee }),
        createBASwapIx({
            swapIn,
            swapOut,
            poolAtaA: longPoolCurrencyAta,
            poolAtaB: longPoolCollateralAta,
        }),
        liquidateLongPositionCleanup(),
    ]).then(ixes => ixes.flatMap(ix => ix));

    return await send(instructions);
};

export const liquidateShortPosition = async ({
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs) => {
    const instructions = await Promise.all([
        liquidateLongPositionSetup({ minOut, interest, executionFee }),
        createABSwapIx({
            swapIn,
            swapOut,
            poolAtaA: shortPoolCollateralAta,
            poolAtaB: shortPoolCurrencyAta,
        }),
        liquidateLongPositionCleanup(),
    ]).then(ixes => ixes.flatMap(ix => ix));

    return await send(instructions);
};

export const validateLiquidateLongPosition = async () => {
};

export const validateLiquidateShortPosition = async () => {
};

export const liquidateLongPositionSetup = async ({
    minOut,
    interest,
    executionFee,
}: {
    minOut: bigint,
    interest: bigint,
    executionFee: bigint,
}) => {
    return await program.methods
        .liquidatePositionSetup(
            new BN(minOut.toString()),
            new BN(interest.toString()),
            new BN(executionFee.toString()),
            new BN(Date.now() / 1_000 + 60 * 60),
        )
        .accountsPartial({})
        .instruction();
};

export const liquidateLongPositionCleanup = async () => {
    return await program
        .methods
        .liquidatePositionCleanup()
        .accountsPartial({})
        .instruction();
};

export const liquidateShortPositionSetup = async ({
    minOut,
    interest,
    executionFee,
}: {
    minOut: bigint,
    interest: bigint,
    executionFee: bigint,
}) => {
    return await program
        .methods
        .liquidatePositionSetup(
            new BN(minOut.toString()),
            new BN(interest.toString()),
            new BN(executionFee.toString()),
            new BN(Date.now() / 1_000 + 60 * 60),
        )
        .accountsPartial({})
        .instruction();
};

export const liquidateShortPositionCleanup = async () => {
    return await program
        .methods
        .liquidatePositionCleanup()
        .accountsPartial({})
        .instruction();
};


export const liquidateLongPositionWithInvalidPermission = async ({
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs) => {
    const instructions = await Promise.all([
        liquidateLongPositionSetup({ minOut, interest, executionFee }),
        createBASwapIx({
            swapIn,
            swapOut,
            poolAtaA: longPoolCurrencyAta,
            poolAtaB: longPoolCollateralAta,
        }),
        liquidateLongPositionCleanup(),
    ]).then(ixes => ixes.flatMap(ix => ix));

    return await sendInvalid(instructions);
};

export const liquidateLongPositionWithoutExceedingThreshold = async ({
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs) => {
    const instructions = await Promise.all([
        liquidateLongPositionSetup({ minOut, interest, executionFee }),
        createBASwapIx({
            swapIn,
            swapOut,
            poolAtaA: longPoolCurrencyAta,
            poolAtaB: longPoolCollateralAta
        }),
        liquidateLongPositionCleanup(),
    ]).then(ixes => ixes.flatMap(ix => ix));

    return await send(instructions);
};

export const liquidateShortPositionWithInvalidPermission = async ({
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs) => {
    const instructions = await Promise.all([
        liquidateLongPositionSetup({ minOut, interest, executionFee }),
        createABSwapIx({
            swapIn,
            swapOut,
            poolAtaA: shortPoolCollateralAta,
            poolAtaB: shortPoolCurrencyAta,

        }),
        liquidateLongPositionCleanup(),
    ]).then(ixes => ixes.flatMap(ix => ix));

    return await sendInvalid(instructions);
};

export const liquidateShortPositionWithoutExceedingThreshold = async ({
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs) => {
    const instructions = await Promise.all([
        liquidateLongPositionSetup({ minOut, interest, executionFee }),
        createABSwapIx({
            swapIn,
            swapOut,
            poolAtaA: shortPoolCollateralAta,
            poolAtaB: shortPoolCurrencyAta
        }),
        liquidateLongPositionCleanup(),
    ]).then(ixes => ixes.flatMap(ix => ix));

    return await send(instructions);
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
