import { Program, BN } from "@coral-xyz/anchor";
import { TransactionInstruction } from "@solana/web3.js";
import { PDA, getPermission, getTokenProgram } from "../utils";
import {
    ClosePositionSetupArgs,
    ClosePositionSetupAccounts,
    ClosePositionCleanupAccounts,
} from "./closePosition";
import { WasabiSolana } from "../../../idl/wasabi_solana";

export async function createCloseLongPositionSetupInstruction(
    program: Program<WasabiSolana>,
    args: ClosePositionSetupArgs,
    accounts: ClosePositionSetupAccounts,
): Promise<TransactionInstruction> {
    const permission = await getPermission(program, accounts.authority);
    const longPool = PDA.getLongPool(
        accounts.currency,
        accounts.collateral,
        program.programId
    );

    const tokenProgram = await getTokenProgram(program, accounts.collateral);

    return program.methods.closeLongPositionSetup({
        minTargetAmount: new BN(args.minTargetAmount),
        expiration: new BN(args.expiration),
        interest: new BN(args.interest),
        executionFee: new BN(args.executionFee),
    }).accounts({
        closePositionSetup: {
            pool: longPool,
            owner: program.provider.publicKey,
            position: accounts.position,
            permission,
            collateral: accounts.collateral,
            tokenProgram,
        }
    }).instruction();
}

export async function createCloseLongPositionCleanupInstruction(
    program: Program<WasabiSolana>,
    accounts: ClosePositionCleanupAccounts,
): Promise<TransactionInstruction> {
    const longPool = PDA.getLongPool(
        accounts.currency,
        accounts.collateral,
        program.programId
    );

    const lpVault = PDA.getLpVault(accounts.currency, program.programId);
    const [collateralTokenProgram, currencyTokenProgram] = await Promise.all([
        getTokenProgram(program, accounts.collateral),
        getTokenProgram(program, accounts.currency),
    ]);

    // It doesn't seem right that collateral is omitted here - nothing infers it
    return program.methods.closeLongPositionCleanup()
        .accounts({
            closePositionCleanup: {
                owner: program.provider.publicKey,
                authority: accounts.authority,
                pool: longPool,
                currency: accounts.currency,
                position: accounts.position,
                lpVault,
                feeWallet: accounts.feeWallet,
                collateralTokenProgram,
                currencyTokenProgram,
            }
        }).instruction();
}