import { Program, BN } from "@coral-xyz/anchor";
import { TransactionInstruction, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { PDA } from "../utils";
import { WasabiSolana } from "../../../idl/wasabi_solana";

export type OpenShortPositionSetupArgs = {
    /// The nonce of the position
    nonce: number, // u16
    /// The minimum amount out required when swapping
    minTargetAmount: number, // u64
    /// The initial down payment amount required to open the position 
    // (is in `currency` for long positions, `collateralCurrency` for short 
    // positions
    downPayment: number, // u64
    /// The total principal amount to be borrowed for the position.
    principal: number, // u64
    /// The timestamp when this position request expires as a unixtimestamp
    expiration: number, // i64
    /// The fee to be paid for the position
    fee: number, // u64
    /// Backend authority
    authority: PublicKey,
    /// The address of the currency to be paid for the position.
    currency: PublicKey,
    collateral: PublicKey,
    shortPool: PublicKey,
    permission: PublicKey,
    feeWallet: PublicKey,
}

export type OpenShortPositionCleanupArgs = {
    shortPool: PublicKey,
    position: PublicKey,
}

export async function createOpenShortPositionSetupInstruction(
    program: Program<WasabiSolana>,
    args: OpenShortPositionSetupArgs,
): Promise<TransactionInstruction> {
    let permission: PublicKey;
    const superAdmin = PDA.getSuperAdmin(program.programId);

    const permissionInfo = await program.account.permission.fetch(superAdmin);

    if (permissionInfo.authority === args.authority) {
        permission = superAdmin;
    } else {
        permission = PDA.getAdmin(args.authority, program.programId);
    }

    return program.methods.openShortPositionSetup({
        nonce: args.nonce,
        minTargetAmount: new BN(args.minTargetAmount),
        downPayment: new BN(args.downPayment),
        principal: new BN(args.principal),
        expiration: new BN(args.expiration),
        fee: new BN(args.fee),
    }).accounts({
        owner: program.provider.publicKey,
        lpVault: PDA.getLpVault(args.currency, program.programId),
        shortPool: args.shortPool,
        collateral: args.collateral,
        currency: args.currency,
        permission,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        feeWallet: args.feeWallet,
    }).instruction();
}

export async function createOpenShortPositionCleanupInstruction(
    program: Program<WasabiSolana>,
    args: OpenShortPositionCleanupArgs,
): Promise<TransactionInstruction> {
    return program.methods.openShortPositionCleanup()
        .accounts({
            owner: program.provider.publicKey,
            shortPool: args.shortPool,
            position: args.position,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        }).instruction();
}
