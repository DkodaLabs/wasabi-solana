import { web3 } from "@coral-xyz/anchor";
import {
  createInitializeMintInstruction,
  MintLayout,
  TOKEN_PROGRAM_ID,
  unpackAccount,
  unpackMint,
} from "@solana/spl-token";

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
      programId: TOKEN_PROGRAM_ID,
    }),
  );
  ixes.push(
    createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      mintAuthority ?? payer,
      payer,
      TOKEN_PROGRAM_ID,
    ),
  );

  return { ixes, mint };
};

export const getMultipleTokenAccounts = async (
  connection: web3.Connection,
  keys: web3.PublicKey[],
) => {
  const accountInfos = await connection.getMultipleAccountsInfo(keys);
  return accountInfos.map((accountInfo, index) =>
    unpackAccount(keys[index], accountInfo),
  );
};

export const getMultipleMintAccounts = async (
  connection: web3.Connection,
  keys: web3.PublicKey[],
) => {
  const accountInfos = await connection.getMultipleAccountsInfo(keys);
  return accountInfos.map((accountInfo, index) =>
    unpackMint(keys[index], accountInfo),
  );
};
