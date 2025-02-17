import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
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
