import { ApiV3PoolInfoStandardItemCpmm, CpmmKeys, Percent, TokenAmount, Token } from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import { initSdk, txVersion } from './raydiumConfig';
import Decimal from 'decimal.js'
import { CREATE_CPMM_POOL_PROGRAM, DEV_CREATE_CPMM_POOL_PROGRAM } from '@raydium-io/raydium-sdk-v2'
import { SendTransactionError } from '@solana/web3.js';

const VALID_PROGRAM_ID = new Set([CREATE_CPMM_POOL_PROGRAM.toBase58(), DEV_CREATE_CPMM_POOL_PROGRAM.toBase58()])

export const isValidCpmm = (id: string) => VALID_PROGRAM_ID.has(id)

export const deposit = async () => {
    const raydium = await initSdk()

    const poolId = 'q3wJcUUr2XiyG9KTeHJgPAcSKGgFdS1wajwRWwS9uZM';
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

    const uiInputAmountA = '2000000000'
    const uiInputAmountB = '111680'

    //const poolRatio = poolInfo.tokenB.balance.toNumber() / poolInfo.tokenA.balance.toNumber()
    //const inputRatio = Number(uiInputAmountB) / Number(uiInputAmountA)

    //console.log('Ratios:', {
    //    poolCurrentRatio: poolRatio,
    //    inputRatio: inputRatio,
    //    poolTokenABalance: poolInfo.tokenA.balance.toString(),
    //    poolTokenBBalance: poolInfo.tokenB.balance.toString()
    //})

    const amountInA = new BN(new Decimal(uiInputAmountA).mul(10 ** poolInfo.mintA.decimals).toFixed(0))
    const amountInB = new BN(new Decimal(uiInputAmountB).mul(10 ** poolInfo.mintB.decimals).toFixed(0))

    try {
        const { execute } = await raydium.liquidity.addLiquidity({
            poolInfo,
            poolKeys,
            amountInA: new TokenAmount(new Token({ mint: "Ana1MHFrtjQ7KUMfutsmDpLf1z3s4evakshVdWnxY1RC", decimals: 5 }), amountInA),
            amountInB: new TokenAmount(new Token({
                mint: "8kEYsPTovQ4R5S5asTp18XZkSCgTsPnVZgVxrctA5p3X", decimals: 6
            }), amountInB),
            otherAmountMin: new TokenAmount(new Token({ mint: "Ana1MHFrtjQ7KUMfutsmDpLf1z3s4evakshVdWnxY1RC", decimals: 5 }), 0),
            txVersion,
            fixedSide: 'a',
            computeBudgetConfig: {
                units: 160000,
                microLamports: 200000000,
            },
        })
        const { txId } = await execute({ sendAndConfirm: true })
        console.log('pool deposited', { txId: `https://explorer.solana.com/tx/${txId}` })
    } catch (error: SendTransactionError | any) {
        console.error('Error details:', {
            message: error.message,
            code: error?.err?.InstructionError?.[1]?.Custom,
            instruction: error?.err?.InstructionError?.[0]
        });

        if (error.logs || error.getLogs) {
            const logs = error.getLogs?.() || error.logs;
            console.log('Transaction logs:', logs);
        }
    }
}

deposit();
