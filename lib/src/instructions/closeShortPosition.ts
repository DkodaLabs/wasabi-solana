import { Program, BN } from "@coral-xyz/anchor";
import { TransactionInstruction } from "@solana/web3.js";
import { PDA, getPermission, getTokenProgram } from "../utils";
import {
    ClosePositionSetupArgs,
    ClosePositionSetupAccounts,
    ClosePositionCleanupAccounts,
} from "./closePosition";
import { WasabiSolana } from "../../../idl/wasabi_solana";


export async function createCloseShortPositionSetupInstruction(
    program: Program<WasabiSolana>,
    args: ClosePositionSetupArgs,
    accounts: ClosePositionSetupAccounts,
): Promise<TransactionInstruction> {
    const permission = await getPermission(program, accounts.authority);
    const shortPool = PDA.getShortPool(
        accounts.currency,
        accounts.collateral,
        program.programId
    );

    const tokenProgram = await getTokenProgram(program, accounts.collateral);

    return program.methods.closeShortPositionSetup({
        minTargetAmount: new BN(args.minTargetAmount),
        expiration: new BN(args.expiration),
        interest: new BN(args.interest),
        executionFee: new BN(args.executionFee),
    }).accounts({
        closePositionSetup: {
            pool: shortPool,
            owner: program.provider.publicKey,
            position: accounts.position,
            permission,
            collateral: accounts.collateral,
            tokenProgram,
        }
    }).instruction();

}

export async function createCloseShortPositionCleanupInstruction(
    program: Program<WasabiSolana>,
    accounts: ClosePositionCleanupAccounts,
): Promise<TransactionInstruction> {
    const shortPool = PDA.getShortPool(
        accounts.currency,
        accounts.collateral,
        program.programId
    );

    const lpVault = PDA.getLpVault(accounts.currency, program.programId);
    const [collateralTokenProgram, currencyTokenProgram] = await Promise.all([
        getTokenProgram(program, accounts.collateral),
        getTokenProgram(program, accounts.currency),
    ]);

    return program.methods.closeShortPositionCleanup()
        .accounts({
            closePositionCleanup: {
                owner: program.provider.publicKey,
                authority: accounts.authority,
                pool: shortPool,
                currency: accounts.currency,
                position: accounts.position,
                lpVault,
                feeWallet: accounts.feeWallet,
                collateralTokenProgram,
                currencyTokenProgram,
            }
        }).instruction();
}
