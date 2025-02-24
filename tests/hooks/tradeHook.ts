import { assert } from 'chai';
import { BN, utils, Program, web3, workspace } from '@coral-xyz/anchor';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
    setupTestEnvironment,
    superAdminProgram,
    NON_SWAP_AUTHORITY,
    SWAP_AUTHORITY,
    feeWalletA,
    feeWalletB,
    liquidationWalletA,
    liquidationWalletB,
    lpVaultA,
    lpVaultB,
    tokenMintA,
    tokenMintB,
    vaultA,
    vaultB,
    user2,
    WASABI_PROGRAM_ID
} from './rootHook';
import { getMultipleTokenAccounts } from '../utils';
import { initWasabi } from './initWasabi';
import {
    initPools,
    longPoolKey,
    longPoolCurrencyAta,
    longPoolCollateralAta,
    shortPoolKey,
    shortPoolCurrencyAta,
    shortPoolCollateralAta,
    initInvalidLongPool,
    initInvalidShortPool,
    invalidLongPool,
    invalidShortPool,
} from './poolHook';
import { WasabiSolana } from '../../target/types/wasabi_solana';
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    createMintToInstruction,
    createBurnCheckedInstruction
} from '@solana/spl-token';

const program = workspace.WasabiSolana as Program<WasabiSolana>;

interface OpenPositionArgs {
    minOut: bigint;
    downPayment: bigint;
    principal: bigint;
    fee: bigint;
    swapIn: bigint;
    swapOut: bigint;
}

export interface ClosePositionArgs {
    minOut: bigint;
    interest: bigint;
    executionFee: bigint;
    swapIn: bigint;
    swapOut: bigint;
}

export const defaultOpenLongPositionArgs = <OpenPositionArgs>{
    minOut: BigInt(1_900),
    downPayment: BigInt(1_000),
    principal: BigInt(1_000),
    fee: BigInt(10),
    swapIn: BigInt(2_000),
    swapOut: BigInt(1_900),
};

export const defaultOpenShortPositionArgs = <OpenPositionArgs>{
    minOut: BigInt(1),
    downPayment: BigInt(1_000),
    principal: BigInt(1_000),
    fee: BigInt(10),
    swapIn: BigInt(1_000),
    swapOut: BigInt(1),
};

export const defaultCloseLongPositionArgs = <ClosePositionArgs>{
    minOut: BigInt(0),
    interest: BigInt(1),
    executionFee: BigInt(11),
    expiration: BigInt(Date.now() / 1_000 + 60 * 60),
    swapIn: BigInt(1_900),
    swapOut: BigInt(2_000),
};

export const defaultCloseShortPositionArgs = <ClosePositionArgs>{
    minOut: BigInt(0),
    interest: BigInt(1),
    executionFee: BigInt(10),
};

export const openLongPosition = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: {
    minOut: bigint,
    downPayment: bigint,
    principal: bigint,
    fee: bigint,
    swapIn: bigint,
    swapOut: bigint
}) => {
    const instructions = await Promise.all([
        openLongPositionSetup({
            minOut,
            downPayment,
            principal,
            fee,
        }),

        createABSwapIx({
            swapIn,
            swapOut,
            poolAtaA: longPoolCurrencyAta,
            poolAtaB: longPoolCollateralAta
        }),

        openLongPositionCleanup(),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    console.log(JSON.stringify(instructions));

    return await send(instructions);
}

export const openShortPosition = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: {
    minOut: bigint,
    downPayment: bigint,
    principal: bigint,
    fee: bigint,
    swapIn: bigint,
    swapOut: bigint
}) => {
    const instructions = await Promise.all([
        openShortPositionSetup({
            minOut,
            downPayment,
            principal,
            fee,
        }),

        createABSwapIx({
            swapIn,
            swapOut,
            poolAtaA: shortPoolCollateralAta,
            poolAtaB: shortPoolCurrencyAta
        }),

        openShortPositionCleanup(),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    console.log(JSON.stringify(instructions));

    return await send(instructions);
};

export const closeLongPosition = async ({
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: {
    minOut: bigint,
    interest: bigint,
    executionFee: bigint,
    swapIn: bigint,
    swapOut: bigint
}) => {
    const instructions = await Promise.all([
        closeLongPositionSetup({ minOut, interest, executionFee }),
        createBASwapIx({
            swapIn,
            swapOut,
            poolAtaA: longPoolCurrencyAta,
            poolAtaB: longPoolCollateralAta
        }),
        closeLongPositionCleanup()
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return await send(instructions);
};

export const closeShortPosition = async ({
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: {
    minOut: bigint,
    interest: bigint,
    executionFee: bigint,
    swapIn: bigint,
    swapOut: bigint
}) => {
    const instructions = await Promise.all([
        closeShortPositionSetup({ minOut, interest, executionFee }),
        createABSwapIx({
            swapIn,
            swapOut,
            poolAtaA: shortPoolCollateralAta,
            poolAtaB: shortPoolCurrencyAta
        }),
        closeShortPositionCleanup()
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return await send(instructions);
};

export const send = async (instructions: TransactionInstruction[]) => {
    const connection = program.provider.connection;
    const message = new web3.TransactionMessage({
        instructions,
        payerKey: program.provider.publicKey!,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    }).compileToV0Message([]);

    const tx = new web3.VersionedTransaction(message);

    return await program.provider.sendAndConfirm(tx, [SWAP_AUTHORITY], {
        skipPreflight: false, // NEVER `skipPreflight=true` during testing
    });
};

export const sendInvalid = async (instructions: TransactionInstruction[]) => {
    const connection = program.provider.connection;
    const message = new web3.TransactionMessage({
        instructions,
        payerKey: program.provider.publicKey!,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    }).compileToV0Message([]);

    const tx = new web3.VersionedTransaction(message);

    // Signer matches the authority and permission, but does not have permission
    // to cosign swaps
    return await program.provider.sendAndConfirm(tx, [NON_SWAP_AUTHORITY], {
        skipPreflight: false,
    });
};

export const [openPositionRequest] = PublicKey.findProgramAddressSync(
    [
        utils.bytes.utf8.encode("open_pos"),
        program.provider.publicKey.toBuffer(),
    ],
    WASABI_PROGRAM_ID
);

const positionNonce = 69;

const [longPositionKey] = web3.PublicKey.findProgramAddressSync(
    [
        utils.bytes.utf8.encode("position"),
        program.provider.publicKey.toBuffer(),
        longPoolKey.toBuffer(),
        lpVaultA.toBuffer(),
        new BN(positionNonce).toArrayLike(Buffer, "le", 2), // NOTE: Remember to change this when upgrading from u16 -> u32
    ],
    WASABI_PROGRAM_ID
);

const [shortPositionKey] = web3.PublicKey.findProgramAddressSync(
    [
        utils.bytes.utf8.encode("position"),
        program.provider.publicKey.toBuffer(),
        shortPoolKey.toBuffer(),
        lpVaultA.toBuffer(),
        new BN(positionNonce).toArrayLike(Buffer, "le", 2), // NOTE: Remember to change this when upgrading from u16 -> u32
    ],
    WASABI_PROGRAM_ID
);

export const openLongPositionSetup = async ({
    minOut,
    downPayment,
    principal,
    fee,
}: {
    minOut: bigint,
    downPayment: bigint,
    principal: bigint,
    fee: bigint,
}) => {
    const now = new Date().getTime() / 1_000;

    return await program.methods.openLongPositionSetup(
        positionNonce,
        new BN(minOut.toString()),
        new BN(downPayment.toString()),
        new BN(principal.toString()),
        new BN(fee.toString()),
        new BN(now + 3600),
    ).accountsPartial({
        owner: program.provider.publicKey,
        lpVault: lpVaultA,
        pool: longPoolKey,
        collateral: tokenMintB,
        currency: tokenMintA,
        authority: SWAP_AUTHORITY.publicKey,
        permission: coSignerPermission,
        feeWallet: feeWalletA,
        tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openLongPositionCleanup = async () => {
    return program.methods
        .openLongPositionCleanup()
        .accountsPartial({
            owner: program.provider.publicKey,
            pool: longPoolKey,
            position: longPositionKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        }).instruction();
};

export const openShortPositionSetup = async ({
    minOut,
    downPayment,
    principal,
    fee,
}: {
    minOut: bigint,
    downPayment: bigint,
    principal: bigint,
    fee: bigint,
}) => {
    const now = new Date().getTime() / 1_000;

    return await program.methods.openShortPositionSetup(
        positionNonce,
        new BN(minOut.toString()),
        new BN(downPayment.toString()),
        new BN(principal.toString()),
        new BN(fee.toString()),
        new BN(now + 3600),
    ).accountsPartial({
        owner: program.provider.publicKey,
        lpVault: lpVaultB,
        pool: shortPoolKey,
        collateral: tokenMintA,
        currency: tokenMintB,
        authority: SWAP_AUTHORITY.publicKey,
        permission: coSignerPermission,
        feeWallet: feeWalletB,
        currencyTokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openShortPositionCleanup = async () => {
    return program.methods
        .openShortPositionCleanup()
        .accountsPartial({
            owner: program.provider.publicKey,
            pool: shortPoolKey,
            position: shortPositionKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        }).instruction();
};

export const closeLongPositionSetup = async ({
    minOut,
    interest,
    executionFee,
}: {
    minOut: bigint,
    interest: bigint,
    executionFee: bigint,
}) => {
    const expiration = Date.now() / 1_000 + 60 * 60;

    return await program.methods
        .closeLongPositionSetup(
            new BN(minOut.toString()),
            new BN(interest.toString()),
            new BN(executionFee.toString()),
            new BN(expiration)
        ).accountsPartial({
            owner: program.provider.publicKey,
            closePositionSetup: {
                pool: longPoolKey,
                owner: program.provider.publicKey,
                collateral: tokenMintB,
                position: longPositionKey,
                permission: ctx.swapPermission,
                authority: SWAP_AUTHORITY.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
        }).instruction();
};

export const closeLongPositionCleanup = async () => {
    return await program.methods.closeLongPositionCleanup().accountsPartial({
        owner: program.provider.publicKey,
        //@ts-ignore
        ownerPayoutAccount: ownerTokenA,
        pool: longPoolKey,
        position: longPositionKey,
        currency: tokenMintA,
        collateral: tokenMintB,
        authority: SWAP_AUTHORITY.publicKey,
        feeWallet: feeWalletA,
        liquidationWallet: liquidationWalletA,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        currencyTokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
};

export const closeShortPositionSetup = async ({
    minOut,
    interest,
    executionFee,
}: {
    minOut: bigint,
    interest: bigint,
    executionFee: bigint,
}) => {
    return await program.methods.closeShortPositionSetup(
        new BN(minOut.toString()),
        new BN(interest.toString()),
        new BN(executionFee.toString()),
        new BN(Date.now() / 1_000 + 60 * 60),
    ).accountsPartial({
        owner: program.provider.publicKey,
        closePositionSetup: {
            owner: program.provider.publicKey,
            position: shortPositionKey,
            pool: shortPoolKey,
            collateral: tokenMintA,
            authority: SWAP_AUTHORITY.publicKey,
            permission: coSignerPermission,
            tokenProgram: TOKEN_PROGRAM_ID,
        }
    }).instruction();
};

export const closeShortPositionCleanup = async () => {
    return await program.methods.closeShortPositionCleanup().accountsPartial({
        owner: program.provider.publicKey,
        //@ts-ignore
        collateral: tokenMintA,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        closePositionCleanup: {
            owner: program.provider.publicKey,
            ownerPayoutAccount: ownerTokenB,
            pool: shortPoolKey,
            collateral: tokenMintA,
            currency: tokenMintB,
            position: shortPositionKey,
            authority: SWAP_AUTHORITY.publicKey,
            feeWallet: feeWalletB,
            liquidationWallet: liquidationWalletB,
            collateralTokenProgram: TOKEN_PROGRAM_ID,
            currencyTokenProgram: TOKEN_PROGRAM_ID,
        }
    }).instruction();
};

export const positionStates = async (isLong: boolean) => {
    const [
        [vault, ownerToken, poolCurrencyAta, poolCollateralAta],
        positionRequest,
        position,
    ] = await Promise.all([
        getMultipleTokenAccounts(program.provider.connection, isLong ? [
            vaultA,
            ownerTokenA,
            longPoolCurrencyAta,
            longPoolCollateralAta,
        ] : [
            vaultB,
            ownerTokenB,
            shortPoolCurrencyAta,
            shortPoolCollateralAta,
        ], TOKEN_PROGRAM_ID),
        program.account.openPositionRequest.fetchNullable(openPositionRequest),
        program.account.position.fetchNullable(isLong ? longPositionKey : shortPositionKey),
    ]);

    return {
        vault,
        ownerToken,
        poolCurrencyAta,
        poolCollateralAta,
        positionRequest,
        position,
    };
};

export const validateOpenLongPositionStates = async (
    beforePromise: ReturnType<typeof positionStates>,
    afterPromise: ReturnType<typeof positionStates>,
    principal: bigint,
    downPayment: bigint,
    fee: bigint
) => {
    const [before, after] = await Promise.all([beforePromise, afterPromise]);
    console.log("BEFORE: ", before);
    console.log("AFTER: ", after);

    if (!after.position) throw new Error("Failed to create position");

    // Assert position has correct values
    assert.equal(
        after.position.trader.toString(),
        program.provider.publicKey.toString(),
    );
    assert.ok(after.position.collateralAmount.gt(new BN(0)));
    assert.equal(
        after.position.collateral.toString(),
        tokenMintB.toString(),
    );
    assert.equal(
        after.position.collateralVault.toString(),
        longPoolCollateralAta.toString(),
    );
    assert.equal(after.position.currency.toString(), tokenMintA.toString());
    assert.equal(
        after.position.downPayment.toString(),
        downPayment.toString(),
    );
    assert.equal(after.position.principal.toString(), principal.toString());
    assert.equal(after.position.lpVault.toString(), lpVaultA.toString());

    // Assert vault balance decreased by Principal
    assert.equal(
        after.vault.amount,
        before.vault.amount - principal,
    );
    // Assert user balance decreased by downpayment
    assert.equal(
        after.ownerToken.amount,
        before.ownerToken.amount -
        downPayment -
        fee
    );
    // Assert collateral vault balance has increased
    assert.isTrue(after.poolCollateralAta.amount > before.poolCollateralAta.amount);

    // Assert the open position request account was closed
    assert.isNull(after.positionRequest);
};

export const validateOpenShortPositionStates = async (
    beforePromise: ReturnType<typeof positionStates>,
    afterPromise: ReturnType<typeof positionStates>,
    principal: bigint,
    downPayment: bigint,
    fee: bigint
) => {
    const [before, after] = await Promise.all([beforePromise, afterPromise]);
    console.log("BEFORE: ", before);
    console.log("AFTER: ", after);

    // Assert position has correct values
    assert.equal(
        after.position.trader.toString(),
        program.provider.publicKey.toString(),
    );
    // Assert it's greater than downpayment since it's collateral + downpayment
    assert.ok(after.position.collateralAmount.gt(new BN(downPayment.toString())));
    assert.equal(
        after.position.collateral.toString(),
        tokenMintA.toString(),
    );
    assert.equal(
        after.position.collateralVault.toString(),
        shortPoolCollateralAta.toString(),
    );
    assert.equal(after.position.currency.toString(), tokenMintB.toString());
    assert.equal(
        after.position.downPayment.toString(),
        downPayment.toString(),
    );
    assert.equal(after.position.principal.toString(), principal.toString());
    assert.equal(after.position.lpVault.toString(), lpVaultB.toString());

    // Assert vault balance decreased by Principal
    assert.equal(
        after.vault.amount,
        before.vault.amount - principal
    );

    // Assert user balance decreased by downpayment
    assert.equal(
        after.ownerToken.amount,
        before.ownerToken.amount -
        downPayment -
        fee
    );

    // Assert collateral vault balance has increased by more than down payment
    assert.isTrue(
        after.poolCollateralAta.amount >
        before.poolCollateralAta.amount + downPayment
    );

    // Assert user paid full down payment
    assert.equal(
        after.ownerToken.amount,
        before.ownerToken.amount -
        downPayment -
        fee
    );

    // Assert the borrowed token amount is not left in the user's wallet
    assert.equal(after.ownerToken.amount, before.ownerToken.amount);

    // Assert the currency_vault amount has not changed
    assert.equal(
        after.poolCurrencyAta.amount,
        before.poolCurrencyAta.amount,
    );
}

export const validateOpenLongPosition = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs) => {
    const statesBefore = positionStates(true);
    await openLongPosition({ minOut, downPayment, principal, fee, swapIn, swapOut });
    const statesAfter = positionStates(true);
    await validateOpenLongPositionStates(statesBefore, statesAfter, principal, downPayment, fee);
};

export const validateOpenShortPosition = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs
) => {
    const statesBefore = positionStates(false);
    await openShortPosition({ minOut, downPayment, principal, fee, swapIn, swapOut });
    const statesAfter = positionStates(false);
    await validateOpenShortPositionStates(statesBefore, statesAfter, principal, downPayment, fee);
}

/**
* Invalid Open Positions
**/
export const openLongPositionWithInvalidSetup = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs) => {
    const instructions = await Promise.all([
        openLongPositionSetup({ minOut, downPayment, principal, fee }),
        openLongPositionSetup({ minOut, downPayment, principal, fee }),
        createABSwapIx({ swapIn, swapOut, poolAtaA: longPoolCurrencyAta, poolAtaB: longPoolCollateralAta }),
        openLongPositionCleanup(),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return await send(instructions);
};

export const openShortPositionWithInvalidSetup = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs
) => {
    const instructions = await Promise.all([
        openShortPositionSetup({ minOut, downPayment, principal, fee }),
        openShortPositionSetup({ minOut, downPayment, principal, fee }),
        createBASwapIx({
            swapIn,
            swapOut,
            poolAtaA: shortPoolCurrencyAta,
            poolAtaB: shortPoolCollateralAta
        }),
        openShortPositionCleanup(),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return await send(instructions);
};

export const openLongPositionWithoutCleanup = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs) => {
    const instructions = await Promise.all([
        openLongPositionSetup({ minOut, downPayment, principal, fee }),
        createABSwapIx({ swapIn, swapOut, poolAtaA: longPoolCurrencyAta, poolAtaB: longPoolCollateralAta }),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return send(instructions);
};

export const openShortPositionWithoutCleanup = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs) => {
    const instructions = await Promise.all([
        openShortPositionSetup({ minOut, downPayment, principal, fee }),
        createABSwapIx({ swapIn, swapOut, poolAtaA: shortPoolCurrencyAta, poolAtaB: shortPoolCollateralAta }),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return send(instructions);
};


export const openLongPositionWithInvalidPool = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs) => {
    const instructions = await Promise.all([
        openLongPositionSetup({ minOut, downPayment, principal, fee }),
        createABSwapIx({ swapIn, swapOut, poolAtaA: longPoolCurrencyAta, poolAtaB: longPoolCollateralAta }),
        openLongPositionCleanupWithInvalidPool(),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return send(instructions);
};

export const openShortPositionWithInvalidPool = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs) => {
    const instructions = await Promise.all([
        openShortPositionSetup({ minOut, downPayment, principal, fee }),
        createABSwapIx({
            swapIn,
            swapOut,
            poolAtaA: shortPoolCurrencyAta,
            poolAtaB: shortPoolCollateralAta
        }),
        openShortPositionCleanupWithInvalidPool(),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return send(instructions);
};

export const openLongPositionCleanupWithInvalidPool = async () => {
    return await program.methods.openLongPositionCleanup(
    ).accountsPartial({
        owner: program.provider.publicKey,
        pool: invalidLongPool,
        position: longPositionKey,
        tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openShortPositionCleanupWithInvalidPool = async () => {
    return await program.methods.openShortPositionCleanup(
    ).accountsPartial({
        owner: program.provider.publicKey,
        pool: invalidShortPool,
        position: shortPositionKey,
        tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openLongPositionWithoutCosigner = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs) => {
    const instructions = await Promise.all([
        openLongPositionSetupWithoutCosigner({ minOut, downPayment, principal, fee }),
        createABSwapIx({ swapIn, swapOut, poolAtaA: longPoolCurrencyAta, poolAtaB: longPoolCollateralAta }),
        openLongPositionCleanup(),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return sendInvalid(instructions);
};

export const openLongPositionSetupWithoutCosigner = async ({
    minOut,
    downPayment,
    principal,
    fee,
}: {
    minOut: bigint,
    downPayment: bigint,
    principal: bigint, // maxIn
    fee: bigint,
}) => {
    const now = new Date().getTime() / 1_000;

    return await program.methods.openLongPositionSetup(
        positionNonce,
        new BN(minOut.toString()),
        new BN(downPayment.toString()),
        new BN(principal.toString()),
        new BN(fee.toString()),
        new BN(now + 3600),
    ).accountsPartial({
        owner: program.provider.publicKey,
        lpVault: lpVaultA,
        pool: longPoolKey,
        collateral: tokenMintB,
        currency: tokenMintA,
        authority: NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
        permission: invalidPermission,
        feeWallet: feeWalletA,
        tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openShortPositionWithoutCosigner = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs) => {
    const instructions = await Promise.all([
        openShortPositionSetupWithoutCosigner({ minOut, downPayment, principal, fee }),
        createABSwapIx({ swapIn, swapOut, poolAtaA: longPoolCurrencyAta, poolAtaB: longPoolCollateralAta }),
        openShortPositionCleanup(),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return sendInvalid(instructions);
};

export const openShortPositionSetupWithoutCosigner = async ({
    minOut,
    downPayment,
    principal,
    fee,
}: {
    minOut: bigint,
    downPayment: bigint,
    principal: bigint, // maxIn
    fee: bigint,
}) => {
    const now = new Date().getTime() / 1_000;

    return await program.methods.openShortPositionSetup(
        positionNonce,
        new BN(minOut.toString()),
        new BN(downPayment.toString()),
        new BN(principal.toString()),
        new BN(fee.toString()),
        new BN(now + 3600),
    ).accountsPartial({
        owner: program.provider.publicKey,
        lpVault: lpVaultB,
        pool: shortPoolKey,
        collateral: tokenMintA,
        currency: tokenMintB,
        authority: NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
        permission: invalidPermission,
        feeWallet: feeWalletB,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        currencyTokenProgram: TOKEN_PROGRAM_ID,
    }).instruction();
};

export const openLongPositionWithInvalidPosition = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs) => {
    const instructions = await Promise.all([
        openLongPositionSetup({ minOut, downPayment, principal, fee }),
        createABSwapIx({
            swapIn,
            swapOut,
            poolAtaA: longPoolCurrencyAta,
            poolAtaB: longPoolCollateralAta
        }),
        openLongPositionCleanup(),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    await send(instructions);
};

export const openShortPositionWithInvalidPosition = async ({
    minOut,
    downPayment,
    principal,
    fee,
    swapIn,
    swapOut,
}: OpenPositionArgs) => {
    const instructions = await Promise.all([
        openShortPositionSetup({ minOut, downPayment, principal, fee }),
        createABSwapIx({
            swapIn,
            swapOut,
            poolAtaA: shortPoolCollateralAta,
            poolAtaB: shortPoolCurrencyAta
        }),
        openShortPositionCleanup(),
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    await send(instructions);
};

/**
* Invalid Close Positions
**/
export const closeLongPositionWithIncorrectOwner = async ({
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs) => {
    const instructions = await Promise.all([
        program.methods.closeLongPositionSetup(
            new BN(minOut.toString()),
            new BN(interest.toString()),
            new BN(executionFee.toString()),
            new BN(Date.now() / 1_000 + 60 * 60),
        ).accountsPartial({
            owner: user2.publicKey, // Incorrect owner
            closePositionSetup: {
                pool: longPoolKey,
                owner: user2.publicKey, // Incorrect owner
                collateral: tokenMintB,
                position: longPositionKey,
                permission: coSignerPermission,
                authority: SWAP_AUTHORITY.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
        }).instruction(),

        createBASwapIx({
            swapIn,
            swapOut,
            poolAtaA: longPoolCurrencyAta,
            poolAtaB: longPoolCollateralAta
        }),

        closeLongPositionCleanup()
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return await send(instructions);
};

export const closeLongPositionWithoutCosigner = async ({
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs) => {
    const instructions = await Promise.all([
        program.methods.closeLongPositionSetup(
            new BN(minOut.toString()),
            new BN(interest.toString()),
            new BN(executionFee.toString()),
            new BN(Date.now() / 1_000 + 60 * 60),
        ).accountsPartial({
            owner: program.provider.publicKey,
            closePositionSetup: {
                pool: longPoolKey,
                owner: program.provider.publicKey,
                collateral: tokenMintB,
                position: longPositionKey,
                permission: invalidPermission, // Valid permission w/o singer permission
                authority: NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
                tokenProgram: TOKEN_PROGRAM_ID,
            },
        }).instruction(),

        createBASwapIx({
            swapIn,
            swapOut,
            poolAtaA: longPoolCurrencyAta,
            poolAtaB: longPoolCollateralAta
        }),

        closeLongPositionCleanup()
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return await sendInvalid(instructions);
}

export const closeLongPositionWithInvalidSetup = async ({
    minOut,
    interest,
    executionFee,
}: {
    minOut: bigint,
    interest: bigint,
    executionFee: bigint,
}) => {
    const instructions = await closeLongPositionSetup({
        minOut,
        interest,
        executionFee
    });

    return await send([instructions, instructions]);
}

export const closeLongPositionWithoutCleanup = async ({
    minOut,
    interest,
    executionFee,
}: ClosePositionArgs) => {
    return await send([await closeLongPositionSetup({
        minOut,
        interest,
        executionFee
    })]);
}

export const closeShortPositionWithIncorrectOwner = async ({
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs) => {
    const instructions = await Promise.all([
        program.methods.closeShortPositionSetup(
            new BN(minOut.toString()),
            new BN(interest.toString()),
            new BN(executionFee.toString()),
            new BN(Date.now() / 1_000 + 60 * 60),
        ).accountsPartial({
            owner: user2.publicKey, // Incorrect owner
            closePositionSetup: {
                pool: shortPoolKey,
                owner: user2.publicKey, // Incorrect owner
                collateral: tokenMintA,
                position: longPositionKey,
                permission: coSignerPermission,
                authority: SWAP_AUTHORITY.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
        }).instruction(),

        createBASwapIx({
            swapIn,
            swapOut,
            poolAtaA: shortPoolCollateralAta,
            poolAtaB: shortPoolCurrencyAta,
        }),

        closeShortPositionCleanup()
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return await send(instructions);
};

export const closeShortPositionWithoutCosigner = async ({
    minOut,
    interest,
    executionFee,
    swapIn,
    swapOut,
}: ClosePositionArgs) => {
    const instructions = await Promise.all([
        program.methods.closeShortPositionSetup(
            new BN(minOut.toString()),
            new BN(interest.toString()),
            new BN(executionFee.toString()),
            new BN(Date.now() / 1_000 + 60 * 60),
        ).accountsPartial({
            owner: program.provider.publicKey,
            closePositionSetup: {
                pool: longPoolKey,
                owner: program.provider.publicKey,
                collateral: tokenMintB,
                position: longPositionKey,
                permission: invalidPermission, // Valid permission w/o singer permission
                authority: NON_SWAP_AUTHORITY.publicKey, // Incorrect authority
                tokenProgram: TOKEN_PROGRAM_ID,
            },
        }).instruction(),

        createBASwapIx({
            swapIn,
            swapOut,
            poolAtaA: shortPoolCollateralAta,
            poolAtaB: shortPoolCurrencyAta,
        }),

        closeShortPositionCleanup()
    ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

    return await sendInvalid(instructions);
}

export const closeShortPositionWithInvalidSetup = async ({
    minOut,
    interest,
    executionFee,
}: {
    minOut: bigint,
    interest: bigint,
    executionFee: bigint
}) => {
    const instructions = await closeShortPositionSetup({
        minOut,
        interest,
        executionFee
    });

    return await send([instructions, instructions]);
}

export const closeShortPositionWithoutCleanup = async ({
    minOut,
    interest,
    executionFee,
}: {
    minOut: bigint,
    interest: bigint,
    executionFee: bigint
}) => {
    return await send([await closeLongPositionSetup({
        minOut,
        interest,
        executionFee
    })]);
}


export const createABSwapIx = async ({
    swapIn,
    swapOut,
    poolAtaA,
    poolAtaB,
}: {
    swapIn: bigint,
    swapOut: bigint,
    poolAtaA: PublicKey,
    poolAtaB: PublicKey,
}) => {
    return await Promise.all([
        createBurnCheckedInstruction(
            poolAtaA,
            tokenMintA,
            SWAP_AUTHORITY.publicKey,
            swapIn,
            6,
        ),

        createMintToInstruction(
            tokenMintB,
            poolAtaB,
            program.provider.publicKey,
            swapOut,
        )
    ]);
}

export const createBASwapIx = async ({
    swapIn,
    swapOut,
    poolAtaA,
    poolAtaB,
}: {
    swapIn: bigint,
    swapOut: bigint,
    poolAtaA: PublicKey,
    poolAtaB: PublicKey,
}) => {
    return Promise.all([
        createBurnCheckedInstruction(
            poolAtaB,
            tokenMintB,
            SWAP_AUTHORITY.publicKey,
            swapIn,
            6,
        ),

        createMintToInstruction(
            tokenMintA,
            poolAtaA,
            program.provider.publicKey,
            swapOut,
        )
    ]);
}

export const initSwapPermission = async (authority: PublicKey) => {
    return await superAdminProgram.methods.initOrUpdatePermission({
        canCosignSwaps: true,
        canInitVaults: false,
        canLiquidate: false,
        canInitPools: false,
        canBorrowFromVaults: false,
        status: { active: {} }
    }).accountsPartial({
        payer: superAdminProgram.provider.publicKey,
        newAuthority: authority,
    }).rpc();
};

export const initInvalidPermission = async (authority: PublicKey) => {
    return await superAdminProgram.methods.initOrUpdatePermission({
        canCosignSwaps: false,
        canInitVaults: true,
        canLiquidate: true,
        canInitPools: true,
        canBorrowFromVaults: true,
        status: { active: {} }
    }).accountsPartial({
        payer: superAdminProgram.provider.publicKey,
        newAuthority: authority,
    }).rpc();
}

export const initInvalidPools = async () => {
    return await Promise.all([initInvalidLongPool(), initInvalidShortPool()]);
}

export const mochaHooks = {
    beforeAll: async () => {
        await setupTestEnvironment();
        await initWasabi();
        await initPools();
        await initInvalidPools();
        await initSwapPermission(SWAP_AUTHORITY.publicKey);
        await initInvalidPermission(invalidPermission);
    }
};
