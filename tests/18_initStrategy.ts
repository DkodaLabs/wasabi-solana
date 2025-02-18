import * as anchor from "@coral-xyz/anchor";
import { createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import {
    superAdminProgram,
    tokenMintA,
    tokenMintB,
    NON_BORROW_AUTHORITY,
    BORROW_AUTHORITY,
} from "./rootHooks";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

describe("InitStrategy", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

    const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            program.programId,
        );

    it("should create the strategy", async () => {
        const currency = tokenMintA;
        const collateral = tokenMintB;

        const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
            superAdminProgram.programId
        );

        const vaultAta = getAssociatedTokenAddressSync(
            tokenMintA,
            lpVault,
            true,
            TOKEN_PROGRAM_ID
        );

        const collateralVault = getAssociatedTokenAddressSync(
            tokenMintB,
            lpVault,
            true,
            TOKEN_PROGRAM_ID,
        );

        const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("strategy"), lpVault.toBuffer(), collateral.toBuffer()],
            superAdminProgram.programId,
        );

        const collateralVaultAtaIx = createAssociatedTokenAccountIdempotentInstruction(
            BORROW_AUTHORITY.publicKey,
            collateralVault,
            lpVault,
            collateral,
            TOKEN_PROGRAM_ID
        );

        const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("admin"),
                BORROW_AUTHORITY.publicKey.toBuffer(),
            ],
            program.programId,
        );

        try {
            await superAdminProgram.methods.initStrategy().accountsPartial({
                //@ts-ignore
                authority: BORROW_AUTHORITY.publicKey,
                permission,
                lpVault: lpVault,
                vault: vaultAta,
                currency,
                collateral,
                strategy: strategy,
                collateralVault,
                systemProgram: SystemProgram.programId,

            })
                .preInstructions([collateralVaultAtaIx])
                .signers([BORROW_AUTHORITY])
                .rpc();

            const strategyAccount = await superAdminProgram.account.strategy.fetchNullable(strategy);

            if (!strategyAccount) {
                throw new Error("Strategy account not created");
            }

            assert(strategyAccount.collateralVault.equals(collateralVault));
            assert(strategyAccount.currency.equals(tokenMintA));
            assert(strategyAccount.collateral.equals(tokenMintB));
            assert(strategyAccount.lpVault.equals(lpVault));
        } catch (err) {
            assert.ok(false);
        }
    })

    describe("Strategy account already exists", () => {
        it("should fail", async () => {
            const currency = tokenMintA;
            const collateral = tokenMintB;

            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                superAdminProgram.programId
            );

            const vaultAta = getAssociatedTokenAddressSync(
                tokenMintA,
                lpVault,
                true,
                TOKEN_PROGRAM_ID
            );

            const collateralVault = getAssociatedTokenAddressSync(
                tokenMintB,
                lpVault,
                true,
                TOKEN_PROGRAM_ID,
            );

            const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy"), lpVault.toBuffer(), collateral.toBuffer()],
                superAdminProgram.programId,
            );

            const collateralVaultAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                NON_BORROW_AUTHORITY.publicKey,
                collateralVault,
                lpVault,
                collateral,
                TOKEN_PROGRAM_ID
            );

            try {
                await superAdminProgram.methods.initStrategy().accountsPartial({
                    //@ts-ignore
                    authority: superAdminProgram.provider.publicKey,
                    permission: superAdminPermissionKey,
                    lpVault: lpVault,
                    vault: vaultAta,
                    currency,
                    collateral,
                    strategy: strategy,
                    collateralVault,
                    systemProgram: SystemProgram.programId,

                })
                    .preInstructions([collateralVaultAtaIx])
                    .signers([NON_BORROW_AUTHORITY])
                    .rpc();
                assert.ok(false);
            } catch (err) {
                assert.ok(true);
            }
        });
    })

    //describe("non permissioned signer", () => {
    //    it("should fail", async () => {
    //        const currency = tokenMintB;
    //        const collateral = tokenMintA;
    //
    //        const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
    //            [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintB.toBuffer()],
    //            superAdminProgram.programId,
    //        );
    //
    //        const vaultAta = getAssociatedTokenAddressSync(
    //            currency,
    //            lpVault,
    //            true,
    //            TOKEN_PROGRAM_ID)
    //
    //        const collateralVault = getAssociatedTokenAddressSync(
    //            collateral,
    //            lpVault,
    //            true,
    //            TOKEN_PROGRAM_ID,
    //        );
    //
    //        const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
    //            [anchor.utils.bytes.utf8.encode("strategy"), lpVault.toBuffer(), collateral.toBuffer()],
    //            superAdminProgram.programId,
    //        );
    //
    //        const collateralVaultAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    //            NON_BORROW_AUTHORITY.publicKey,
    //            collateralVault,
    //            lpVault,
    //            collateral,
    //            TOKEN_PROGRAM_ID
    //        );
    //
    //        const [nonBorrowPermission] = anchor.web3.PublicKey.findProgramAddressSync(
    //            [
    //                anchor.utils.bytes.utf8.encode("admin"),
    //                NON_BORROW_AUTHORITY.publicKey.toBuffer()
    //            ],
    //            program.programId
    //        );
    //
    //        try {
    //            await program.methods.initStrategy().accountsPartial({
    //                authority: NON_BORROW_AUTHORITY.publicKey,
    //                permission: nonBorrowPermission,
    //                lpVault,
    //                vault: vaultAta,
    //                currency,
    //                collateral,
    //                strategy,
    //                collateralVault,
    //                systemProgram: SystemProgram.programId,
    //            })
    //                .preInstructions([collateralVaultAtaIx])
    //                .signers([NON_BORROW_AUTHORITY])
    //                .rpc()
    //
    //            assert.ok(false);
    //        } catch (err) {
    //            console.log(err);
    //            if (err instanceof anchor.AnchorError) {
    //                assert.equal(err.error.errorCode.number, 6000);
    //            } else {
    //                assert.ok(false);
    //            }
    //        }
    //    })
    //})
});
