import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";
import { superAdminProgram, tokenMintA, tokenMintB } from "./rootHooks";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

describe("InitShortPool", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

    const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            program.programId
        );

    const [permissionKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("admin"),
            program.provider.publicKey.toBuffer(),
        ],
        program.programId,
    );

    it("should create the short pool", async () => {
        try {
            await superAdminProgram.methods
                .initShortPool()
                .accounts({
                    payer: superAdminProgram.provider.publicKey,
                    permission: superAdminPermissionKey,
                    collateral: tokenMintA,
                    currency: tokenMintB,
                    collateralTokenProgram: TOKEN_PROGRAM_ID,
                    currencyTokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();
        } catch (e: any) {
            console.log(await e.getLogs(program.provider.connection));
        }
        const [shortPoolKey] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("short_pool"),
                tokenMintA.toBuffer(),
                tokenMintB.toBuffer(),
            ],
            superAdminProgram.programId
        );
        const collateralVaultKey = getAssociatedTokenAddressSync(
            tokenMintA,
            shortPoolKey,
            true
        );
        const currencyVaultKey = getAssociatedTokenAddressSync(
            tokenMintB,
            shortPoolKey,
            true
        );
        const [shortPoolAfter, collateralVault, currencyVault] = await Promise.all([
            superAdminProgram.account.basePool.fetch(shortPoolKey),
            program.provider.connection.getAccountInfo(collateralVaultKey),
            program.provider.connection.getAccountInfo(currencyVaultKey),
        ]);

        // Validate short pool was created
        assert.equal(shortPoolAfter.collateral.toString(), tokenMintA.toString());
        assert.equal(
            shortPoolAfter.collateralVault.toString(),
            collateralVaultKey.toString()
        );
        assert.equal(shortPoolAfter.currency.toString(), tokenMintB.toString());
        assert.equal(
            shortPoolAfter.currencyVault.toString(),
            currencyVaultKey.toString()
        );
        assert.isNotNull(collateralVault);
        assert.isNotNull(currencyVault);
        assert.ok(!shortPoolAfter.isLongPool);
    });

    describe("non permissioned signer", () => {
        it("should fail", async () => {
            const NO_AUTH = anchor.web3.Keypair.generate();
            const _noPermissionTxn = await superAdminProgram.methods.initOrUpdatePermission({
                canCosignSwaps: true,
                canInitVaults: false,
                canInitPool: false,
                canLiquidate: false,
                canBorrowFromVaults: false,
                status: { active: {} },
            }).accounts({
                payer: superAdminProgram.provider.publicKey,
                newAuthority: NO_AUTH.publicKey,
            }).rpc();

            const [noPerm] = anchor.web3.PublicKey.findProgramAddressSync(
                [
                    anchor.utils.bytes.utf8.encode("admin"),
                    NO_AUTH.publicKey.toBuffer(),
                ],
                program.programId,
            );

            try {
                await program.methods
                    .initShortPool()
                    .accountsPartial({
                        payer: program.provider.publicKey,
                        authority: NO_AUTH.publicKey,
                        permission: noPerm,
                        collateral: tokenMintB,
                        currency: tokenMintA,
                        collateralTokenProgram: TOKEN_PROGRAM_ID,
                        currencyTokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .signers([NO_AUTH])
                    .rpc();
                assert.ok(false);
            } catch (e: any) {
                if (e instanceof anchor.AnchorError) {
                    assert.equal(e.error.errorCode.number, 6000);
                } else {
                    assert.ok(false);
                }
            }
        });
    });
});
