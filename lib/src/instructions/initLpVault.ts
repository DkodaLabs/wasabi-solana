import { Program } from "@coral-xyz/anchor";
import { TransactionInstruction, PublicKey } from "@solana/web3.js";
import { WasabiSolana } from "../../../idl/wasabi_solana";
import { PDA } from "../utils";

export type InitLpVaultArgs = {
    admin: PublicKey,
    assetMint: PublicKey,
}

export async function createInitLpVaultInstruction(
    program: Program<WasabiSolana>,
    args: InitLpVaultArgs,
): Promise<TransactionInstruction> {
    let permission: PublicKey;
    const superAdmin = PDA.getSuperAdmin(program.programId);
    const permissionInfo = await program.account.permission.fetch(superAdmin);

    if (permissionInfo.authority === args.admin) {
        permission = superAdmin;
    } else {
        permission = PDA.getAdmin(args.admin, program.programId);
    }

    return program.methods.initLpVault()
        .accounts({
            payer: program.provider.publicKey,
            permission,
            assetMint: args.assetMint,
        }).instruction();
}
