import { Program } from "@coral-xyz/anchor";
import { TransactionInstruction, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, } from "@solana/spl-token";
import { WasabiSolana } from "../../../idl/wasabi_solana";
import { PDA } from "../utils";

export type InitLongPoolArgs = {
    asset: PublicKey,
    currency: PublicKey,
    admin: PublicKey,
}

export async function createInitLongPoolInstruction(
    program: Program<WasabiSolana>,
    args: InitLongPoolArgs,
): Promise<TransactionInstruction> {
    let permission: PublicKey;
    const superAdmin = PDA.getSuperAdmin(program.programId);

    const permissionInfo = await program.account.permission.fetch(superAdmin);

    if (permissionInfo.authority === args.admin) {
        permission = superAdmin;
    } else {
        permission = PDA.getAdmin(args.admin, program.programId);
    }

    return program.methods.initLongPool()
        .accounts({
            payer: program.provider.publicKey,
            permission,
            collateral: args.asset,
            currency: args.currency,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        }).instruction();
}
