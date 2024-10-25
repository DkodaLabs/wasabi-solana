import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import base58 from "bs58";
import * as fs from 'fs';

dotenv.config();

const PRIVATE_KEY = process.env.DEVNET_PRIVATE_KEY; // Private key from phantom
const PUBLIC_KEY = process.env.DEVNET_PUBLIC_KEY; // Fill with your address to verify
console.log("Generating private key array for", PUBLIC_KEY);
const secret = base58.decode(PRIVATE_KEY);

// Check if the pk is correct 
const pair = Keypair.fromSecretKey(secret);

if (pair.publicKey.toString() == PUBLIC_KEY) {
  fs.writeFileSync(
    'devnet-program-deployer.json',
    JSON.stringify(Array.from(secret))
  );
}
