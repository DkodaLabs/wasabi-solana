import { Program, BN } from "@coral-xyz/anchor";
import { TransactionInstruction, PublicKey } from "@solana/web3.js";
import { WasabiSolana } from "../../../idl/wasabi_solana";
import { PDA } from "../utils";

export type UpdateVaultMaxBorrowArgs = {
    admin: PublicKey,
    assetMint: PublicKey,
    maxBorrow: number, // u64
}

export async function createUpdateMaxBorrowInstruction(
    program: Program<WasabiSolana>,
    args: UpdateVaultMaxBorrowArgs,
): Promise<TransactionInstruction> {
    let permission: PublicKey;
    const superAdmin = PDA.getSuperAdmin(program.programId);
    const permissionInfo = await program.account.permission.fetch(superAdmin);
    const lpVault = PDA.getLpVault(args.assetMint, program.programId);

    if (permissionInfo.authority === args.admin) {
        permission = superAdmin;
    } else {
        permission = PDA.getAdmin(args.admin, program.programId);
    }

    return program.methods.updateLpVaultMaxBorrow({
        maxBorrow: new BN(args.maxBorrow),
    }).accounts({
        payer: program.provider.publicKey,
        permission,
        lpVault,
    }).instruction();
}
