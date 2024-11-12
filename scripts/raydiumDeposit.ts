import { ApiV3PoolInfoStandardItemCpmm, CpmmKeys, Percent, TokenAmount, Token } from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import { initSdk, txVersion } from './raydiumConfig';
import Decimal from 'decimal.js'
import { CREATE_CPMM_POOL_PROGRAM, DEV_CREATE_CPMM_POOL_PROGRAM } from '@raydium-io/raydium-sdk-v2'

const VALID_PROGRAM_ID = new Set([CREATE_CPMM_POOL_PROGRAM.toBase58(), DEV_CREATE_CPMM_POOL_PROGRAM.toBase58()])

export const isValidCpmm = (id: string) => VALID_PROGRAM_ID.has(id)

export const deposit = async () => {
    const raydium = await initSdk()

    const poolId = 'i76e7ZM784vUMoHQDGnE39Z44Z6pdiTEGYUWfCX85Ay';
    let poolInfo;
    let poolKeys;

    if (raydium.cluster === 'mainnet') {
        const data = await raydium.api.fetchPoolById({ ids: poolId })
        poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm
        if (!isValidCpmm(poolInfo.programId)) throw new Error('target pool is not CPMM pool')
    } else {
        const data = await raydium.liquidity.getPoolInfoFromRpc({ poolId })
        console.log(data);
        poolInfo = data.poolInfo
        poolKeys = data.poolKeys
    }
    console.log(poolKeys);

    const uiInputAmountA = '100000'
    const uiInputAmountB = '18000000'
    const amountInA = new BN(new Decimal(uiInputAmountA).mul(10 ** poolInfo.mintA.decimals).toFixed(0))
    const amountInB = new BN(new Decimal(uiInputAmountB).mul(10 ** poolInfo.mintA.decimals).toFixed(0))

    const { execute } = await raydium.liquidity.addLiquidity({
        poolInfo,
        poolKeys,
        amountInA: new TokenAmount(new Token({ mint: "8kEYsPTovQ4R5S5asTp18XZkSCgTsPnVZgVxrctA5p3X", decimals: 6 }), amountInA),
        amountInB: new TokenAmount(new Token({
            mint: "D1TTPYBrEoNejgBoMsg6hNgLMPRFUfiqqwmTz2k4XACF", decimals: 6
        }), amountInB),
        otherAmountMin: new TokenAmount(new Token({ mint: "8kEYsPTovQ4R5S5asTp18XZkSCgTsPnVZgVxrctA5p3X", decimals: 6 }), 1),
        txVersion,
        fixedSide: 'a',
        computeBudgetConfig: {
            units: 60000,
            microLamports: 100000000,
        },
    })
    const { txId } = await execute({ sendAndConfirm: true })
    console.log('pool deposited', { txId: `https://explorer.solana.com/tx/${txId}` })
}

deposit();
