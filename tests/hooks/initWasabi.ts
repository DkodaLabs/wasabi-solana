import * as anchor from "@coral-xyz/anchor";
import { SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountIdempotentInstruction,
    TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";
import {
    MPL_TOKEN_METADATA_PROGRAM_ID
} from '@metaplex-foundation/mpl-token-metadata';
import {
    lpVaultA,
    lpVaultB,
    tokenMintA,
    tokenMintB,
    superAdminProgram,
    feeWalletKeypair,
    liquidationWalletKeypair,
    SWAP_AUTHORITY,
} from "./allHook";
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

    // Vaults
    const vaultAAta = getAssociatedTokenAddressSync(
        tokenMintA,
        lpVaultA,
        true,
        TOKEN_PROGRAM_ID
    );

    const vaultBAta = getAssociatedTokenAddressSync(
        tokenMintB,
        lpVaultB,
        true,
        TOKEN_PROGRAM_ID
    );

    const vaultAAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        SWAP_AUTHORITY.publicKey,
        vaultAAta,
        lpVaultA,
        tokenMintA,
        TOKEN_PROGRAM_ID
    );

    const vaultBAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        SWAP_AUTHORITY.publicKey,
        vaultBAta,
        lpVaultB,
        tokenMintB,
        TOKEN_PROGRAM_ID
    );

    const initLpVaultAIx = await superAdminProgram.methods.initLpVault({
        name: "PLACEHOLDER",
        symbol: "PLC",
        uri: "https://placeholder.com",
    }).accountsPartial({
        payer: superAdminProgram.provider.publicKey,
        vault: vaultAAta,
        permission: superAdminPermissionKey,
        assetMint: tokenMintA,
        assetTokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
    }).instruction();

    await superAdminProgram.methods.initLpVault({
        name: "PLACEHOLDER",
        symbol: "PLC",
        uri: "https://placeholder.com",
    }).accountsPartial({
        payer: superAdminProgram.provider.publicKey,
        vault: vaultBAta,
        permission: superAdminPermissionKey,
        assetMint: tokenMintB,
        assetTokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
    }).preInstructions([vaultAAtaIx, vaultBAtaIx, initLpVaultAIx]).signers([SWAP_AUTHORITY]).rpc();

    // Seed vaults
    const [lpVaultAData, lpVaultBData] = await Promise.all([
        superAdminProgram.account.lpVault.fetch(lpVaultA),
        superAdminProgram.account.lpVault.fetch(lpVaultB),
    ]);

    const ownerSharesAccountA = getAssociatedTokenAddressSync(
        lpVaultAData.sharesMint,
        program.provider.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
    );
    const ownerSharesAccountB = getAssociatedTokenAddressSync(
        lpVaultBData.sharesMint,
        program.provider.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
    );

    // Create shares atas
    const ownerSharesAccountAIx = createAssociatedTokenAccountIdempotentInstruction(
        SWAP_AUTHORITY.publicKey,
        ownerSharesAccountA,
        program.provider.publicKey,
        lpVaultAData.sharesMint,
        TOKEN_2022_PROGRAM_ID
    );
    const ownerSharesAccountBIx = createAssociatedTokenAccountIdempotentInstruction(
        SWAP_AUTHORITY.publicKey,
        ownerSharesAccountB,
        program.provider.publicKey,
        lpVaultBData.sharesMint,
        TOKEN_2022_PROGRAM_ID
    );
    const depositAIx = await program.methods.deposit(new anchor.BN(1_000_000_000))
        .accountsPartial({
            owner: program.provider.publicKey,
            lpVault: lpVaultA,
            assetMint: tokenMintA,
            assetTokenProgram: TOKEN_PROGRAM_ID,
        }).instruction();

    await program.methods.deposit(new anchor.BN(1_000_000_000))
        .accountsPartial({
            owner: program.provider.publicKey,
            lpVault: lpVaultB,
            assetMint: tokenMintB,
            assetTokenProgram: TOKEN_PROGRAM_ID,
        }).preInstructions([
            ownerSharesAccountAIx,
            ownerSharesAccountBIx,
            depositAIx
        ])
        .signers([SWAP_AUTHORITY])
        .rpc();
};

