import { DEVNET_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2';
import { PublicKey } from "@solana/web3.js";
import { initSdk, txVersion } from './raydiumConfig';

export const createMarket = async () => {
    const raydium = await initSdk()

    const { execute, extInfo, transactions } = await raydium.marketV2.create({
        baseInfo: {
            mint: new PublicKey("Ana1MHFrtjQ7KUMfutsmDpLf1z3s4evakshVdWnxY1RC"),
            decimals: 5,
        },
        quoteInfo: {
            mint: new PublicKey("D1TTPYBrEoNejgBoMsg6hNgLMPRFUfiqqwmTz2k4XACF"),
            decimals: 6,
        },
        lotSize: 1,
        tickSize: 0.01,
        //dexProgramId: OPEN_BOOK_PROGRAM,
        dexProgramId: DEVNET_PROGRAM_ID.OPENBOOK_MARKET, // devnet

        requestQueueSpace: 5120 + 12, // optional
        eventQueueSpace: 262144 + 12, // optional
        orderbookQueueSpace: 65536 + 12, // optional

        txVersion,
        computeBudgetConfig: {
            units: 60000,
            microLamports: 100000000,
        },
    })

    console.log(
        `create market total ${transactions.length} txs, market info: `,
        Object.keys(extInfo.address).reduce(
            (acc, cur) => ({
                ...acc,
                [cur]: extInfo.address[cur as keyof typeof extInfo.address].toBase58(),
            }),
            {}
        )
    )

    const txIds = await execute({
        // true means tx will be sent when the previous one has been confirmed
        sequentially: true,
    })

    console.log('create market txIds:', txIds)
}

createMarket();
