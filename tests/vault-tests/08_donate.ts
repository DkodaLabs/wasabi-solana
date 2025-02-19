//import * as anchor from "@coral-xyz/anchor";
//import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
//import { assert } from "chai";
//import { WasabiSolana } from "../target/types/wasabi_solana";
//import { tokenMintA, NON_SWAP_AUTHORITY, superAdminProgram } from "./rootHooks";
//import { getAssociatedTokenAddressSync } from "@solana/spl-token";
//import { getMultipleMintAccounts, getMultipleTokenAccounts } from "./utils";
//
//describe("Donate", () => {
//    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
//    const [coSignerPermission] = anchor.web3.PublicKey.findProgramAddressSync(
//        [
//            anchor.utils.bytes.utf8.encode("admin"),
//            NON_SWAP_AUTHORITY.publicKey.toBuffer(),
//        ],
//        program.programId
//    );
//    const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
//        [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
//        program.programId
//    );
//    let lpVault: anchor.IdlAccounts<WasabiSolana>["lpVault"];
//
//    before(async () => {
//        lpVault = await program.account.lpVault.fetch(lpVaultKey);
//        await superAdminProgram.methods.initOrUpdatePermission({
//                canCosignSwaps: true, // 4
//                canInitVaults: true, // 1
//                canLiquidate: true, // 2
//                canBorrowFromVaults: true, // 8
//                canInitPools: true, // 16
//                canManageWallets: true, // 32
//                status: { active: {} }
//        })
//        .accounts({
//                payer: superAdminProgram.provider.publicKey,
//                newAuthority: program.provider.publicKey,
//        })
//        .rpc();
//    });
//
//    it("Should allow donation of assets", async () => {
//        const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
//            [
//                anchor.utils.bytes.utf8.encode("admin"),
//                program.provider.publicKey.toBuffer(),
//            ],
//            program.programId,
//        );
//        const tokenAmount = new anchor.BN(1_000_000);
//        const tokenAAta = getAssociatedTokenAddressSync(
//            tokenMintA,
//            program.provider.publicKey,
//            false
//        );
//        const [[ownerTokenABefore, vaultABefore], [sharesMintBefore]] =
//            await Promise.all([
//                getMultipleTokenAccounts(program.provider.connection, [
//                    tokenAAta,
//                    lpVault.vault,
//                ], TOKEN_PROGRAM_ID),
//                getMultipleMintAccounts(program.provider.connection, [
//                    lpVault.sharesMint,
//                ], TOKEN_2022_PROGRAM_ID),
//            ]);
//
//        await program.methods
//            .donate(tokenAmount)
//            .accounts({
//                owner: program.provider.publicKey,
//                lpVault: lpVaultKey,
//                currency: tokenMintA,
//                permission,
//                tokenProgram: TOKEN_PROGRAM_ID,
//            })
//            .rpc();
//
//        const [[ownerTokenAAfter, vaultAAfter], lpVaultAfter, [sharesMintAfter]] =
//            await Promise.all([
//                getMultipleTokenAccounts(program.provider.connection, [
//                    tokenAAta,
//                    lpVault.vault,
//                ], TOKEN_PROGRAM_ID),
//                program.account.lpVault.fetch(lpVaultKey),
//                getMultipleMintAccounts(program.provider.connection, [
//                    lpVault.sharesMint,
//                ], TOKEN_2022_PROGRAM_ID),
//            ]);
//
//        // Validate no shares were minted
//        assert.equal(sharesMintAfter.supply, sharesMintBefore.supply);
//
//        // Validate tokens were transfered from the user's account to the vault
//        const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
//        assert.equal(-ownerADiff, BigInt(tokenAmount.toString()));
//        const vaultADiff = vaultAAfter.amount - vaultABefore.amount;
//        assert.equal(vaultADiff, BigInt(tokenAmount.toString()));
//
//        // Validate the LpVault total assets was incremented properly
//        const lpVaultAssetCountDiff = lpVaultAfter.totalAssets.sub(
//            lpVault.totalAssets
//        );
//        assert.equal(lpVaultAssetCountDiff.toString(), tokenAmount.toString());
//    });
//});
