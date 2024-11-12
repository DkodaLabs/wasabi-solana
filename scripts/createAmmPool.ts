import {
    MARKET_STATE_LAYOUT_V3,
    //AMM_V4,
    //OPEN_BOOK_PROGRAM,
    FEE_DESTINATION_ID,
    DEVNET_PROGRAM_ID,
} from '@raydium-io/raydium-sdk-v2'
import { PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { initSdk, txVersion, connection } from './raydiumConfig';
import BN from 'bn.js'

export const createAmmPool = async () => {
    const raydium = await initSdk();
    const marketId = new PublicKey(`4dCdw8Am7FW5JsKyS3iBex7v2cMYiPodxZyJ2CFVq5fn`);

    const marketBufferInfo = await raydium.connection.getAccountInfo(new PublicKey(marketId))
    const { baseMint, quoteMint } = MARKET_STATE_LAYOUT_V3.decode(marketBufferInfo!.data)

    const baseMintInfo = await raydium.token.getTokenInfo(baseMint)
    const quoteMintInfo = await raydium.token.getTokenInfo(quoteMint)

    if (
        baseMintInfo.programId !== TOKEN_PROGRAM_ID.toBase58() ||
        quoteMintInfo.programId !== TOKEN_PROGRAM_ID.toBase58()
    ) {
        throw new Error(
            'amm pools with openbook market only support TOKEN_PROGRAM_ID mints, if you want to create pool with token-2022, please create cpmm pool instead'
        )
    }

    const { execute, extInfo } = await raydium.liquidity.createPoolV4({
        //programId: AMM_V4,
        programId: DEVNET_PROGRAM_ID.AmmV4, // devnet
        marketInfo: {
            marketId,
            //programId: OPEN_BOOK_PROGRAM,
            programId: DEVNET_PROGRAM_ID.OPENBOOK_MARKET, // devent
        },
        baseMintInfo: {
            mint: baseMint,
            decimals: baseMintInfo.decimals,
        },
        quoteMintInfo: {
            mint: quoteMint,
            decimals: quoteMintInfo.decimals,
        },
        baseAmount: new BN(100_000),
        quoteAmount: new BN(18_000_000),

        startTime: new BN(0), // unit in seconds
        ownerInfo: {
            useSOLBalance: true,
        },
        associatedOnly: false,
        txVersion,
        //feeDestinationId: FEE_DESTINATION_ID,
        feeDestinationId: DEVNET_PROGRAM_ID.FEE_DESTINATION_ID, // devnet
        computeBudgetConfig: {
            units: 600000,
            microLamports: 10000000,
        },
    })

    try {
        const { txId } = await execute({ sendAndConfirm: true })
        console.log(
            'amm pool created! txId: ',
            txId,
            ', poolKeys:',
            Object.keys(extInfo.address).reduce(
                (acc, cur) => ({
                    ...acc,
                    [cur]: extInfo.address[cur as keyof typeof extInfo.address].toBase58(),
                }),
                {}
            )
        )
    } catch (error) {
        console.log("here");
        console.error(error.message);
        console.error(await error.getLogs(connection));
    }
}

createAmmPool();
