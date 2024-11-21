import { Raydium, TxVersion, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2';
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';

const key = fs.readFileSync(process.env.DEVNET_KEYPAIR_FILE);
const jsonKey = Buffer.from(JSON.parse(key.toString()));
export const owner: Keypair = Keypair.fromSecretKey(jsonKey);
export const connection = new Connection('https://devnet.helius-rpc.com/?api-key=1d0eed22-4cbd-4790-b1c9-7f1d07804add');
// MUST BE SET TO LEGACY FOR DEVNET
export const txVersion = TxVersion.LEGACY // or TxVersion.LEGACY
const cluster = 'devnet' // 'mainnet' | 'devnet'

let raydium: Raydium | undefined
export const initSdk = async (params?: { loadToken?: boolean }) => {
    if (raydium) return raydium
    if (connection.rpcEndpoint === clusterApiUrl('devnet'))
        console.warn('using free rpc node might cause unexpected error, strongly suggest uses paid rpc node')
    console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`)
    raydium = await Raydium.load({
        owner,
        connection,
        cluster,
        disableFeatureCheck: true,
        disableLoadToken: !params?.loadToken,
        blockhashCommitment: 'finalized',
    })

    raydium.account.updateTokenAccount(await fetchTokenAccountData())
    connection.onAccountChange(owner.publicKey, async () => {
        raydium!.account.updateTokenAccount(await fetchTokenAccountData())
    })

    return raydium
}

export const fetchTokenAccountData = async () => {
    const solAccountResp = await connection.getAccountInfo(owner.publicKey)
    const tokenAccountResp = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_PROGRAM_ID })
    const token2022Req = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_2022_PROGRAM_ID })
    const tokenAccountData = parseTokenAccountResp({
        owner: owner.publicKey,
        solAccountResp,
        tokenAccountResp: {
            context: tokenAccountResp.context,
            value: [...tokenAccountResp.value, ...token2022Req.value],
        },
    })
    return tokenAccountData
}
