import * as anchor from "@coral-xyz/anchor";
import { createMintToInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import { SWAP_AUTHORITY, superAdminProgram, tokenMintA, tokenMintB } from "./rootHooks";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

describe("CloseStrategy", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

    const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            program.programId
        );
    describe("Collateral remaining in vault", () => {
        it("should fail", async () => {
            const collateral = tokenMintB;

            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                superAdminProgram.programId,
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

            const mintCollateralIx = createMintToInstruction(
                collateral,
                collateralVault,
                SWAP_AUTHORITY.publicKey,
                100_000,
            );

            try {
                await program.methods.closeStrategy().accountsPartial({
                    authority: superAdminProgram.provider.publicKey,
                    permission: superAdminPermissionKey,
                    lpVault,
                    collateral: tokenMintB,
                    strategy,
                    collateralVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                    .preInstructions([mintCollateralIx])
                    .signers([SWAP_AUTHORITY])
                    .rpc();

                assert.ok(false);
            } catch (err) {
                console.log(err);
            }
        });
    })

    it("should properly close the strategy account", async () => {
        const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
            superAdminProgram.programId,
        );

        const collateralVault = getAssociatedTokenAddressSync(
            tokenMintB,
            lpVault,
            true,
            TOKEN_PROGRAM_ID,
        );

        const collateral = tokenMintB;

        const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("strategy"), lpVault.toBuffer(), collateral.toBuffer()],
            superAdminProgram.programId,
        );

        const collateralRemaining = await program.account.strategy.fetch(strategy).then(s => s.collateralAmount);;

        const drainIx = 

        try {
            const tx = await program.methods.closeStrategy().accountsPartial({
                authority: SWAP_AUTHORITY.publicKey,
                permission: superAdminPermissionKey,
                lpVault,
                collateral: tokenMintB,
                strategy,
                collateralVault,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
                .signers([SWAP_AUTHORITY])
                .rpc();

        } catch (err) {
            console.log(err);
        }
    })
});
