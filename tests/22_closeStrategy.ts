import * as anchor from "@coral-xyz/anchor";
import { createMintToInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import { tokenMintA, tokenMintB, BORROW_AUTHORITY } from "./rootHooks";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

describe("CloseStrategy", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

    describe("Collateral remaining in vault", () => {
        it("should fail", async () => {
            const collateral = tokenMintB;

            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                program.programId,
            );

            const collateralVault = getAssociatedTokenAddressSync(
                tokenMintB,
                lpVault,
                true,
                TOKEN_PROGRAM_ID,
            );

            const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy"), lpVault.toBuffer(), collateral.toBuffer()],
                program.programId,
            );

            const mintCollateralIx = createMintToInstruction(
                collateral,
                collateralVault,
                program.provider.publicKey,
                100_000,
            );

            const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                program.programId,
            );

            try {
                await program.methods.closeStrategy().accountsPartial({
                    authority: BORROW_AUTHORITY.publicKey,
                    permission,
                    lpVault,
                    collateral,
                    strategy,
                    collateralVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                    .preInstructions([mintCollateralIx])
                    .signers([BORROW_AUTHORITY])
                    .rpc();

                assert.ok(false);
            } catch (err) {
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6036);
                } else {
                    assert.ok(false);
                }

            }
        });
    })

    describe("correct state", () => {
        it("should properly close the strategy account", async () => {
            const collateral = tokenMintB;

            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                program.programId,
            );

            const collateralVault = getAssociatedTokenAddressSync(
                tokenMintB,
                lpVault,
                true,
                TOKEN_PROGRAM_ID,
            );

            const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy"), lpVault.toBuffer(), collateral.toBuffer()],
                program.programId,
            );

            const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                program.programId
            );

            try {
                await program.methods.closeStrategy().accountsPartial({
                    authority: BORROW_AUTHORITY.publicKey,
                    permission,
                    lpVault,
                    collateral: tokenMintB,
                    strategy,
                    collateralVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                    .signers([BORROW_AUTHORITY])
                    .rpc();

            } catch (err) {
                console.log(err);
                assert.ok(false);
            }
        })
    })
});
