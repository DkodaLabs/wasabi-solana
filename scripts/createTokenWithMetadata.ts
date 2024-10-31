import * as anchor from "@coral-xyz/anchor";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { 
    publicKey, 
    signerIdentity, 
    createSignerFromKeypair, 
    percentAmount,
} from "@metaplex-foundation/umi"
import { 
    mplTokenMetadata, 
    createV1,
    TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata"
import { 
    createMint,
    createAssociatedTokenAccount,
    mintTo,
} from "@solana/spl-token"
import { Connection } from "@solana/web3.js";
import * as fs from 'fs'

async function createTokenWithMetadata() {
    const key = fs.readFileSync(process.env.DEVNET_KEYPAIR_FILE);
    const jsonKey = Buffer.from(JSON.parse(key.toString()));
    const keypair = anchor.web3.Keypair.fromSecretKey(jsonKey);
    const connection = new Connection("https://api.devnet.solana.com");

    const umi = createUmi('https://api.devnet.solana.com')
    const signer = createSignerFromKeypair(umi, {
        publicKey: publicKey(keypair.publicKey),
        secretKey: new Uint8Array(keypair.secretKey),
    })
    umi.use(signerIdentity(signer))
    umi.use(mplTokenMetadata())

    try {
        const mint = await createMint(
            connection,
            keypair,
            keypair.publicKey,
            keypair.publicKey,
            6,
        );
        console.log("Mint created:", mint.toString())

        const ata = await createAssociatedTokenAccount(
            connection,
            keypair,
            mint,
            keypair.publicKey,
        );
        console.log("ATA created:", ata.toString())

        const mintToTx = await mintTo(
            connection,
            keypair,
            mint,
            ata,
            keypair.publicKey,
            1_000_000_000,
        );
        console.log("Mint to tx:", mintToTx)

        const metadataTx = await createV1(umi, {
            mint: publicKey(mint),
            name: "spicy USD",
            symbol: "sUSD",
            uri: "https://wasabi-public.s3.amazonaws.com/tokens/usdc.png",
            sellerFeeBasisPoints: percentAmount(0),
            tokenStandard: TokenStandard.Fungible,
            creators: null,
            uses: null,
            isMutable: true,
        }).sendAndConfirm(umi)

        console.log({
            mint: mint.toString(),
            ata: ata.toString(),
            createMetadataTx: metadataTx.signature
        })
    } catch (error) {
        console.error("Error:", error)
    }
}

createTokenWithMetadata()
