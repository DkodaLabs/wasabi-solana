import * as anchor from "@coral-xyz/anchor";
import {
    superAdminProgram,
    feeWalletKeypair,
    liquidationWalletKeypair,
} from "./rootHook";
import { WasabiSolana } from '../../target/types/wasabi_solana';

export const initWasabi = async () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
    const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            superAdminProgram.programId,
        );

    // Settings
    const initGlobalSettingsIx = await superAdminProgram.methods
        .initGlobalSettings({
            superAdmin: superAdminProgram.provider.publicKey,
            feeWallet: feeWalletKeypair.publicKey,
            liquidationWallet: liquidationWalletKeypair.publicKey,
            statuses: 3,
        })
        .accounts({
            payer: superAdminProgram.provider.publicKey,
        }).instruction();

    const initDebtControllerIx = await superAdminProgram.methods.initDebtController(
        new anchor.BN(500),
        new anchor.BN(200),
        5,
    ).accounts({
        superAdmin: superAdminProgram.provider.publicKey,
    }).instruction();


    await superAdminProgram.methods.initOrUpdatePermission({
        canCosignSwaps: true,
        canInitVaults: true,
        canLiquidate: true,
        canInitPools: true,
        canBorrowFromVaults: true,
        status: { active: {} }
    }).accounts({
        payer: superAdminProgram.provider.publicKey,
        newAuthority: program.provider.publicKey
    }).preInstructions([initGlobalSettingsIx, initDebtControllerIx]).rpc();
};