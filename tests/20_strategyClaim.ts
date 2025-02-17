import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import { SWAP_AUTHORITY, superAdminProgram, tokenMintA, tokenMintB } from "./rootHooks";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

describe("StrategyClaim", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

    const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            program.programId
        );

    describe("Correct setup", () => {
        it("should correctly increment strategy and lp_vault balances", async () => {
            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                superAdminProgram.programId,
            );

            const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy"), lpVault.toBuffer(), tokenMintB.toBuffer()],
                superAdminProgram.programId,
            );
            const newQuote = new anchor.BN(1);

            try {
                const tx = await program.methods.strategyClaimYield(new anchor.BN(newQuote)).accountsPartial({
                    authority: superAdminProgram.provider.publicKey,
                    permission: superAdminPermissionKey,
                    lpVault,
                    collateral: tokenMintB,
                    strategy
                })
                    .signers([SWAP_AUTHORITY])
                    .rpc();
            } catch (err) {
                console.log(err);
            }

        })
    });

    describe("When the interest deviates too much", () => {
        it("should fail", async () => {
        });
    });
});
