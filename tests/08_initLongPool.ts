import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";
import { superAdminProgram, tokenMintA, tokenMintB } from "./rootHooks";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

describe("InitLongPool", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

    const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            program.programId
        );

    it("should create the longPool", async () => {
        await superAdminProgram.methods
            .initLongPool()
            .accounts({
                payer: superAdminProgram.provider.publicKey,
                permission: superAdminPermissionKey,
                collateral: tokenMintA,
                currency: tokenMintB,
                collateralTokenProgram: TOKEN_PROGRAM_ID,
                currencyTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
        const [longPoolKey] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("long_pool"),
                tokenMintA.toBuffer(),
                tokenMintB.toBuffer(),
            ],
            superAdminProgram.programId
        );
        const collateralVaultKey = getAssociatedTokenAddressSync(
            tokenMintA,
            longPoolKey,
            true
        );
        const currencyVaultKey = getAssociatedTokenAddressSync(
            tokenMintB,
            longPoolKey,
            true
        );
        const [longPoolAfter, collateralVault, currencyVault] = await Promise.all([
            superAdminProgram.account.basePool.fetch(longPoolKey),
            program.provider.connection.getAccountInfo(collateralVaultKey),
            program.provider.connection.getAccountInfo(currencyVaultKey),
        ]);

        // Validate long pool was created
        assert.equal(longPoolAfter.collateral.toString(), tokenMintA.toString());
        assert.equal(
            longPoolAfter.collateralVault.toString(),
            collateralVaultKey.toString()
        );
        assert.equal(longPoolAfter.currency.toString(), tokenMintB.toString());
        assert.equal(
            longPoolAfter.currencyVault.toString(),
            currencyVaultKey.toString()
        );
        assert.isNotNull(collateralVault);
        assert.isNotNull(currencyVault);
        assert.ok(longPoolAfter.isLongPool);
    });

    describe("non permissioned signer", () => {
        it("should fail", async () => {
            try {
                await program.methods
                    .initLpVault({
                        name: "PLACEHOLDER",
                        symbol: "PLHDR",
                        uri: "https://placeholder.com",
                    })
                    .accounts({
                        payer: program.provider.publicKey,
                        permission: superAdminPermissionKey,
                        assetMint: tokenMintB,
                        assetTokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .rpc();
                assert.ok(false);
            } catch (err) {
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 2001);
                } else {
                    assert.ok(false);
                }
            }
        });
    });
});
