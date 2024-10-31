import {
    CreateMetadataAccountV3InstructionData,
    MPL_TOKEN_METADATA_PROGRAM_ID,
} from '@metaplex-foundation/mpl-token-metadata';
import {
    PublicKey,
    Connection,
    Keypair,
    Transaction,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import fs from 'fs';
import { warn } from 'console';

const keypairFile = JSON.parse(fs.readFileSync('./keypair.json', 'utf-8'));
const wallet = Keypair.fromSecretKey(new Uint8Array(keypairFile));

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

async function createTokenMetadata(
    tokenMint: PublicKey,
    name: string,
    symbol: string,
    uri: string
) {
    console.log('Creating metadata for:', tokenMint.toBase58());

    // Derive the metadata account address
    const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('metadata'),
            MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            tokenMint.toBuffer(),
        ],
        MPL_TOKEN_METADATA_PROGRAM_ID
    );

    console.log('Metadata address:', metadataAddress.toBase58());

    // Create the instruction
    const instruction = CreateMetadataAccountV3InstructionData(
        {
            metadata: metadataAddress,
            mint: tokenMint,
            mintAuthority: wallet.publicKey,
            payer: wallet.publicKey,
            updateAuthority: wallet.publicKey,
        },
        {
            createMetadataAccountArgsV3: {
                data: {
                    name: name,
                    symbol: symbol,
                    uri: uri,
                    sellerFeeBasisPoints: 0,
                    creators: null,
                    collection: null,
                    uses: null,
                },
                isMutable: true,
                collectionDetails: null,
            },
        }
    );

    // Create and send transaction
    const transaction = new Transaction().add(instruction);

    try {
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [wallet]
        );
        console.log('Transaction signature:', signature);
        return signature;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

// Usage example
async function main() {
    const tokenMint = new PublicKey('YOUR_TOKEN_MINT_ADDRESS');

    const metadata = {
        name: "My Token",
        symbol: "MTKN",
        uri: "https://raw.githubusercontent.com/your-repo/metadata.json",
    };

    try {
        await createTokenMetadata(
            tokenMint,
            metadata.name,
            metadata.symbol,
            metadata.uri
        );
        console.log('Metadata created successfully!');
    } catch (error) {
        console.error('Failed to create metadata:', error);
    }
}

main();
