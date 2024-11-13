import * as anchor from "@coral-xyz/anchor";
import fs from 'fs';
import dotenv from 'dotenv';
import { PublicKey, Connection } from "@solana/web3.js";

// @ts-ignore
const { BN } = anchor.default;

dotenv.config();

const main = async () => {
    console.log("Lookup table...");
    const requestQueue = new PublicKey("HQWh85Gpg5w6siriKNviC3BsECbam1NkHZU3uFJUVVHw");
    const eventQueue = new PublicKey("DQEFJBEdCRNjcmCQGdznb1Vd8VHaa8JRKyjYeksVk3kL");
    const bids = new PublicKey("CC9661goaJ4xe55FPSSaLEFV9QLjwz9kyKcSDUv7WeLC");
    const asks = new PublicKey("BuWYLwERq3Lf7Ndes8pjKNHdwPfPzC39h9j1KZgRdcf2");
    const baseVault = new PublicKey("2N8F8zWGYPqtFd3UbScjfdj8FYYdnNouieFAmawXmL3t");
    const quoteVault = new PublicKey("AHQ1PfrJc1z1zkS1hYNgqmv5jR3ihLmhNvpmHc4dbLYz");
    const baseMint = new PublicKey("D1TTPYBrEoNejgBoMsg6hNgLMPRFUfiqqwmTz2k4XACF");
    const quoteMint = new PublicKey("8kEYsPTovQ4R5S5asTp18XZkSCgTsPnVZgVxrctA5p3X");
    const programId = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8");
    const ammId = new PublicKey("i76e7ZM784vUMoHQDGnE39Z44Z6pdiTEGYUWfCX85Ay");
    const ammAuthority = new PublicKey("DbQqP6ehDYmeYjcBaMRuA8tAJY1EjDUz9DpwSLjaQqfC");
    const ammOpenOrders = new PublicKey("FYE2u9bWzKX6n4d4tGc9StcP3ppqbCgWuvn7YdL685fV");
    const lpMint = new PublicKey("FscqDNtgwvXXFGsG4sPdXwP688zSDYhbSMAhykq7Q5sV");
    const coinMint = new PublicKey("D1TTPYBrEoNejgBoMsg6hNgLMPRFUfiqqwmTz2k4XACF");
    const pcMint = new PublicKey("8kEYsPTovQ4R5S5asTp18XZkSCgTsPnVZgVxrctA5p3X");
    const coinVault = new PublicKey("8nuayDvoWsMrbMCNLk7kPodpfXbqUZ4FKJCfJSnWk7ob");
    const pcVault = new PublicKey("8iYnnYCTL86Pe3Vu2Kn28ucw4BVWVv6oYD7CpsTm81Uw");
    const withdrawQueue = new PublicKey("9DiocNzEupKVyQZixqspwaGi7TVTjx6UTvhb36A4vjn2");
    const ammTargetOrders = new PublicKey("CWmX6Ktt1u6Yoteo3JU7ABS3cNW49jdC7gWG1A8f7RJp");
    const poolTempLp = new PublicKey("CrLirBmTCyxLpgQJtNBpwcKGsyXSrwCsoUPxMHd9V6C4");
    const marketProgramId = new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj");
    const marketId = new PublicKey("4dCdw8Am7FW5JsKyS3iBex7v2cMYiPodxZyJ2CFVq5fn");
    const ammConfigId = new PublicKey("8QN9yfKqWDoKjvZmqFsgCzAqwZBQuzVVnC388dN5RCPo");
    const feeDestinationId = new PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR");

    const key = fs.readFileSync(process.env.DEVNET_KEYPAIR_FILE);
    const jsonKey = Buffer.from(JSON.parse(key.toString()));
    const keypair = anchor.web3.Keypair.fromSecretKey(jsonKey);
    const wallet = new anchor.Wallet(keypair);
    const connection = new Connection("https://api.devnet.solana.com");

    const provider = new anchor.AnchorProvider(connection, wallet);

    const slot = await provider.connection.getSlot();

    const [createLookupTableIx, lookupTableAddress] =
        anchor.web3.AddressLookupTableProgram.createLookupTable({
            authority: provider.publicKey,
            payer: provider.publicKey,
            recentSlot: slot,
        });

    const extendLookupTableIx =
        anchor.web3.AddressLookupTableProgram.extendLookupTable({
            authority: provider.publicKey,
            payer: provider.publicKey,
            lookupTable: lookupTableAddress,
            addresses: [
                requestQueue,
                eventQueue,
                bids,
                asks,
                baseVault,
                quoteVault,
                baseMint,
                quoteMint,
                programId,
                ammId,
                ammAuthority,
                ammOpenOrders,
                lpMint,
                coinMint,
                pcMint,
                coinVault,
                pcVault,
                withdrawQueue,
                ammTargetOrders,
                poolTempLp,
                marketProgramId,
                marketId,
                ammConfigId,
                feeDestinationId,
            ],
        });
    const _tx = new anchor.web3.Transaction()
        .add(createLookupTableIx)
        .add(extendLookupTableIx);
    const txId = await provider.sendAndConfirm(_tx, [], { skipPreflight: true });

    console.log(lookupTableAddress.toBase58());
    console.log(txId);
}

main();
