import { web3 } from "@coral-xyz/anchor";
import {
    createInitializeMintInstruction,
    MintLayout,
    unpackAccount,
    unpackMint,
} from "@solana/spl-token";
import { TransactionInstruction } from "@solana/web3.js";
import { superAdminProgram, WASABI_PROGRAM_ID } from './hooks/allHook';

/**
 * Ixes to create a mint, the payer gains the Mint Tokens/Freeze authority
 * @param payer - pays account init fees, must sign
 * @param provider
 * @param decimals
 * @param mintKeypair - (optional) generates random keypair if not provided, must sign
 * @param lamps - (optional) lamports to pay for created acc, fetches minimum for Mint exemption if
 * not provided
 * @returns ixes, and keypair of new mint
 */
export const createSimpleMint = async (
    payer: web3.PublicKey,
    connection: web3.Connection,
    decimals: number,
    programId: web3.PublicKey,
    mintKeypair?: web3.Keypair,
    lamps?: number,
    mintAuthority?: web3.PublicKey,
) => {
    let mint = mintKeypair ? mintKeypair : web3.Keypair.generate();
    let ixes: web3.TransactionInstruction[] = [];
    const lamports = lamps
        ? lamps
        : await connection.getMinimumBalanceForRentExemption(MintLayout.span);
    ixes.push(
        web3.SystemProgram.createAccount({
            fromPubkey: payer,
            newAccountPubkey: mint.publicKey,
            space: MintLayout.span,
            lamports: lamports,
            programId,
        }),
    );
    ixes.push(
        createInitializeMintInstruction(
            mint.publicKey,
            decimals,
            mintAuthority ?? payer,
            undefined,
            programId,
        ),
    );

    return { ixes, mint };
};

export const getMultipleTokenAccounts = async (
    connection: web3.Connection,
    keys: web3.PublicKey[],
    tokenProgram: web3.PublicKey,

) => {
    const accountInfos = await connection.getMultipleAccountsInfo(keys);
    return accountInfos.map((accountInfo, index) =>
        unpackAccount(keys[index], accountInfo, tokenProgram),
    );
};

export const getMultipleMintAccounts = async (
    connection: web3.Connection,
    keys: web3.PublicKey[],
    tokenProgram: web3.PublicKey,
) => {
    const accountInfos = await connection.getMultipleAccountsInfo(keys);
    return accountInfos.map((accountInfo, index) =>
        unpackMint(keys[index], accountInfo, tokenProgram),
    );
};

export const defaultInitLpVaultArgs = {
    name: "PLACEHOLDER",
    symbol: "PLC",
    uri: "https://placeholder.com",
};

export const initDefaultPermission = async (newAuthority: web3.PublicKey): Promise<TransactionInstruction> => {
    return superAdminProgram.methods.initOrUpdatePermission({
        canCosignSwaps: true, // 4
        canInitVaults: true, // 1
        canLiquidate: true, // 2
        canInitPools: true, // 8
        canBorrowFromVaults: true,
        status: { active: {} }
    }).accountsPartial({
        payer: superAdminProgram.provider.publicKey,
        newAuthority,
    }).instruction();
};

export const getDefaultPermission = (auth: web3.PublicKey) => {
    return web3.PublicKey.findProgramAddressSync(
        [Buffer.from('admin'), auth.toBuffer()],
        WASABI_PROGRAM_ID
    )[0];
}
