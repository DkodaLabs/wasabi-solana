import * as anchor from "@coral-xyz/anchor";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { 
    publicKey, 
    signerIdentity, 
    createSignerFromKeypair, 
    percentAmount 
} from "@metaplex-foundation/umi"
import { 
    mplTokenMetadata, 
    createV1,
    TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata"
import * as fs from 'fs'

async function updateMetadata() {
    const key = fs.readFileSync(process.env.DEVNET_KEYPAIR_FILE);
    const jsonKey = Buffer.from(JSON.parse(key.toString()));
    const keypair = anchor.web3.Keypair.fromSecretKey(jsonKey);

    const umi = createUmi('https://api.devnet.solana.com')

    const signer = createSignerFromKeypair(umi, {
        publicKey: publicKey(keypair.publicKey),
        secretKey: new Uint8Array(keypair.secretKey),
    })
    umi.use(signerIdentity(signer))
    umi.use(mplTokenMetadata())

    const mint = "8kEYsPTovQ4R5S5asTp18XZkSCgTsPnVZgVxrctA5p3X";

    try {
        const builder = createV1(umi, {
            mint: publicKey(mint),
            name: "spicy USD",
            symbol: "sUSD",
            uri: "https://wasabi-public.s3.amazonaws.com/tokens/usdc.png",
            sellerFeeBasisPoints: percentAmount(0),
            tokenStandard: TokenStandard.Fungible,
            creators: null,
            uses: null,
            isMutable: true,
        })

        const tx = await builder.sendAndConfirm(umi)
        console.log("Transaction signature:", tx.signature)
    } catch (error) {
        console.error("Error updating metadata:", error)
    }
}

updateMetadata()
