//import * as anchor from "@coral-xyz/anchor";
//import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
//import { assert } from "chai";
//import { superAdminProgram, tokenMintA, tokenMintB, SWAP_AUTHORITY } from "./rootHooks";
//import {
//    getAssociatedTokenAddressSync,
//    createAssociatedTokenAccountIdempotentInstruction
//} from "@solana/spl-token";
//import { SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js';
//import { MPL_TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
//import { WasabiSolana } from "../../target/types/wasabi_solana";
//
//describe("InitLpVault", () => {
//    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
//
//    const [superAdminPermissionKey] =
//        anchor.web3.PublicKey.findProgramAddressSync(
//            [anchor.utils.bytes.utf8.encode("super_admin")],
//            program.programId,
//        );
//
//    it("should create the LP Vault", async () => {
//        const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
//            [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
//            superAdminProgram.programId,
//        );
//
//        const vaultAta = getAssociatedTokenAddressSync(
//            tokenMintA,
//            lpVaultKey,
//            true,
//            TOKEN_PROGRAM_ID
//        );
//
//        const vaultAtaIx = createAssociatedTokenAccountIdempotentInstruction(
//            SWAP_AUTHORITY.publicKey,
//            vaultAta,
//            lpVaultKey,
//            tokenMintA,
//            TOKEN_PROGRAM_ID
//        );
//
//        await superAdminProgram.methods
//            .initLpVault({
//                name: "PLACEHOLDER",
//                symbol: "PLC",
//                uri: "https://placeholder.com",
//            })
//            .accountsPartial({
//                payer: superAdminProgram.provider.publicKey,
//                vault: vaultAta,
//                permission: superAdminPermissionKey,
//                assetMint: tokenMintA,
//                assetTokenProgram: TOKEN_PROGRAM_ID,
//                tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
//                sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
//            })
//            .preInstructions([vaultAtaIx])
//            .signers([SWAP_AUTHORITY])
//            .rpc();
//        const [sharesMint] = anchor.web3.PublicKey.findProgramAddressSync(
//            [lpVaultKey.toBuffer(), tokenMintA.toBuffer()],
//            superAdminProgram.programId,
//        );
//        const lpVaultAfter = await superAdminProgram.account.lpVault.fetch(lpVaultKey);
//
//        // Validate the LpVault state was set
//        assert.equal(lpVaultAfter.totalAssets.toNumber(), 0);
//        assert.equal(lpVaultAfter.asset.toString(), tokenMintA.toString());
//        const vaultAddress = getAssociatedTokenAddressSync(
//            tokenMintA,
//            lpVaultKey,
//            true,
//        );
//        assert.equal(lpVaultAfter.vault.toString(), vaultAddress.toString());
//        assert.equal(lpVaultAfter.sharesMint.toString(), sharesMint.toString());
//    });
//
//    describe("non permissioned signer", () => {
//        it("should fail", async () => {
//            const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
//                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintB.toBuffer()],
//                superAdminProgram.programId,
//            );
//
//            const vaultAta = getAssociatedTokenAddressSync(
//                tokenMintB,
//                lpVaultKey,
//                true,
//                TOKEN_PROGRAM_ID
//            );
//
//            const vaultAtaIx = createAssociatedTokenAccountIdempotentInstruction(
//                SWAP_AUTHORITY.publicKey,
//                vaultAta,
//                lpVaultKey,
//                tokenMintB,
//                TOKEN_PROGRAM_ID
//            );
//            try {
//                await program.methods
//                    .initLpVault({
//                        name: "PLACEHOLDER",
//                        symbol: "PLC",
//                        uri: "https://placeholder.com",
//                    })
//                    .accountsPartial({
//                        payer: program.provider.publicKey,
//                        permission: superAdminPermissionKey,
//                        vault: vaultAta,
//                        assetMint: tokenMintB,
//                        assetTokenProgram: TOKEN_PROGRAM_ID,
//                        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
//                        sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
//                    })
//                    .preInstructions([vaultAtaIx])
//                    .signers([SWAP_AUTHORITY])
//                    .rpc();
//                assert.ok(false);
//            } catch (err) {
//                if (err instanceof anchor.AnchorError) {
//                    assert.equal(err.error.errorCode.number, 2001);
//                } else {
//                    assert.ok(false);
//                }
//            }
//        });
//    });
//});
