import {assert} from 'chai';
import {PublicKey} from '@solana/web3.js';
import {superAdminProgram} from '../hooks/rootHook';
import {PoolContext} from './poolContext';


export const getPoolStates = async (ctx: PoolContext) => {
    const {currencyVault, collateralVault} = ctx.getPoolAtas();
    return await poolStates(ctx.isLong ? ctx.longPool : ctx.shortPool, currencyVault, collateralVault);
};

const poolStates = async (
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
    ctx: PoolContext,
    statePromise: ReturnType<typeof getPoolStates>,
) => {
    const after = await statePromise;
    const {currencyVault, collateralVault} = ctx.getPoolAtas();

    assert.equal(after.pool.collateral.toString(), ctx.currency.toString());
    assert.equal(
        after.pool.collateralVault.toString(),
        collateralVault.toString()
    );
    assert.equal(after.pool.currency.toString(), ctx.currency.toString());
    assert.equal(
        after.pool.currencyVault.toString(),
        currencyVault.toString()
    );
    assert.isNotNull(collateralVault);
    assert.isNotNull(currencyVault);
    ctx.isLong ? assert.ok(after.pool.isLongPool) : assert.ok(!after.pool.isLongPool);
}

export const validateInitPool = async (ctx: PoolContext) => {

    const stateAfter = getPoolStates(ctx);
    await validatePoolState(ctx, stateAfter);
};
