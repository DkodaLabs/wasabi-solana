import * as anchor from "@coral-xyz/anchor";
import { createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import {
    SWAP_AUTHORITY,
    NON_SWAP_AUTHORITY,
    superAdminProgram,
    tokenMintA,
    tokenMintB,
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
            SWAP_AUTHORITY.publicKey,
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
                .signers([SWAP_AUTHORITY])
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
            console.log(err);
            assert.ok(false);
        }
    })

    describe("non permissioned signer", () => {
        it("should fail", async () => {
            const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintB.toBuffer()],
                superAdminProgram.programId,
            );

            const vaultAta = getAssociatedTokenAddressSync(
                tokenMintB,
                lpVaultKey,
                true,
                TOKEN_PROGRAM_ID)

            const collateralVault = getAssociatedTokenAddressSync(
                tokenMintA,
                lpVaultKey,
                true,
                TOKEN_PROGRAM_ID,
            );

            const collateral = tokenMintA;

            const [strategyKey] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy"), lpVaultKey.toBuffer(), collateral.toBuffer()],
                superAdminProgram.programId,
            );

            const collateralVaultAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                SWAP_AUTHORITY.publicKey,
                collateralVault,
                lpVaultKey,
                tokenMintA,
                TOKEN_PROGRAM_ID
            );

            try {
                await program.methods.initStrategy().accountsPartial({
                    authority: program.provider.publicKey,
                    permission: superAdminPermissionKey,
                    lpVault: lpVaultKey,
                    vault: vaultAta,
                    currency: tokenMintA,
                    collateral: tokenMintB,
                    strategy: strategyKey,
                    collateralVault,
                    systemProgram: SystemProgram.programId,
                })
                    .preInstructions([collateralVaultAtaIx])
                    .signers([SWAP_AUTHORITY])
                    .rpc()

                assert.ok(false);
            } catch (err) {
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 2001);

                } else {
                    assert.ok(false);
                }
            }
        })
    })
});
