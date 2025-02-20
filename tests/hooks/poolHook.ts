import { web3, utils } from '@coral-xyz/anchor';
import { assert } from 'chai';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { WASABI_PROGRAM_ID, setupTestEnvironment, superAdminProgram, tokenMintA, tokenMintB } from './allHook';
import { initWasabi } from './initWasabi';

const [superAdminPermissionKey] = web3.PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("super_admin")],
    WASABI_PROGRAM_ID,
);

export const poolAccounts = (isLong: boolean) => {
    const [currency, collateral] = isLong
        ? [tokenMintA, tokenMintB]
        : [tokenMintB, tokenMintA];

    return {
        payer: superAdminProgram.provider.publicKey,
        permission: superAdminPermissionKey,
        collateral,
        currency,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        currencyTokenProgram: TOKEN_PROGRAM_ID,
    };
}

export const initLongPoolIx = async () => {
    return await superAdminProgram.methods
        .initLongPool()
        .accountsPartial(poolAccounts(true))
        .instruction();
};

export const initInvalidLongPool = async () => {
    return await superAdminProgram.methods
        .initLongPool()
        .accountsPartial(poolAccounts(false))
        .rpc();
}

export const initShortPoolIx = async () => {
    return await superAdminProgram.methods
        .initShortPool()
        .accountsPartial(poolAccounts(false))
        .instruction();
};

export const [invalidShortPool] = web3.PublicKey.findProgramAddressSync(
    [
        Buffer.from("short_pool"),
        tokenMintB.toBuffer(),
        tokenMintA.toBuffer()
    ],
    WASABI_PROGRAM_ID,
);

export const [invalidLongPool] = web3.PublicKey.findProgramAddressSync(
    [
        Buffer.from("long_pool"),
        tokenMintA.toBuffer(),
        tokenMintB.toBuffer()

    ],
    WASABI_PROGRAM_ID
);

export const initInvalidShortPool = async () => {
    return await superAdminProgram.methods
        .initShortPool()
        .accountsPartial(poolAccounts(true))
        .rpc();
}

export const initPools = async () => {
    await superAdminProgram.methods
        .initShortPool()
        .accountsPartial(poolAccounts(false))
        .preInstructions([await initLongPoolIx()]).rpc();
};

export const [longPoolKey] = web3.PublicKey.findProgramAddressSync(
    [
        utils.bytes.utf8.encode("long_pool"),
        tokenMintB.toBuffer(),
        tokenMintA.toBuffer(),
    ],
    WASABI_PROGRAM_ID
);

export const longPoolCurrencyAta = getAssociatedTokenAddressSync(
    tokenMintA,
    longPoolKey,
    true,
    TOKEN_PROGRAM_ID
);

export const longPoolCollateralAta = getAssociatedTokenAddressSync(
    tokenMintB,
    longPoolKey,
    true,
    TOKEN_PROGRAM_ID
);

export const [shortPoolKey] = web3.PublicKey.findProgramAddressSync(
    [
        utils.bytes.utf8.encode("short_pool"),
        tokenMintA.toBuffer(),
        tokenMintB.toBuffer(),
    ],
    WASABI_PROGRAM_ID
);

export const shortPoolCurrencyAta = getAssociatedTokenAddressSync(
    tokenMintB,
    shortPoolKey,
    true,
    TOKEN_PROGRAM_ID
);

export const shortPoolCollateralAta = getAssociatedTokenAddressSync(
    tokenMintA,
    shortPoolKey,
    true,
    TOKEN_PROGRAM_ID
);

export const poolAtas = (isLong: boolean) => {
    const [currency, collateral, pool] = isLong
        ? [tokenMintA, tokenMintB, longPoolKey]
        : [tokenMintB, tokenMintA, shortPoolKey];

    const currencyVaultKey = getAssociatedTokenAddressSync(
        currency,
        pool,
        true
    );

    const collateralVaultKey = getAssociatedTokenAddressSync(
        collateral,
        pool,
        true
    );

    return [currencyVaultKey, collateralVaultKey];
}

export const poolStates = async (isLong: boolean) => {
    const [currencyVault, collateralVault] = poolAtas(isLong);
    return await _poolStates(isLong ? longPoolKey : shortPoolKey, currencyVault, collateralVault);
};

export const _poolStates = async (
    poolKey: PublicKey,
    currencyVaultKey: PublicKey,
    collateralVaultKey: PublicKey
) => {
    const [pool, currency, collateral] = await Promise.all([
        superAdminProgram.account.basePool.fetch(poolKey),
        superAdminProgram.provider.connection.getAccountInfo(currencyVaultKey),
        superAdminProgram.provider.connection.getAccountInfo(collateralVaultKey),
    ]);

    return {
        pool,
        currency,
        collateral,
    }
};

export const validatePoolState = async (
    statePromise: ReturnType<typeof poolStates>,
    isLong: boolean,
) => {
    const after = await statePromise;
    const [currencyVault, collateralVault] = poolAtas(isLong);

    assert.equal(after.pool.collateral.toString(), tokenMintA.toString());
    assert.equal(
        after.pool.collateralVault.toString(),
        collateralVault.toString()
    );
    assert.equal(after.pool.currency.toString(), tokenMintB.toString());
    assert.equal(
        after.pool.currencyVault.toString(),
        currencyVault.toString()
    );
    assert.isNotNull(collateralVault);
    assert.isNotNull(currencyVault);
    isLong ? assert.ok(after.pool.isLongPool) : assert.ok(!after.pool.isLongPool);
}

export const validateInitPool = async (isLong: boolean) => {
    isLong
        ? await superAdminProgram.methods
            .initLongPool()
            .accountsPartial(poolAccounts(true))
            .rpc()
        : await superAdminProgram.methods
            .initShortPool()
            .accountsPartial(poolAccounts(false))
            .rpc();

    const stateAfter = poolStates(isLong);
    await validatePoolState(stateAfter, isLong);
};

export const mochaHooks = {
    beforeAll: async () => {
        await setupTestEnvironment();
        await initWasabi();
    }
}
