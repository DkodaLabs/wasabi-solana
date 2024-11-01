import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { tokenMintA } from "./rootHooks";
import {getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { assert } from "chai";
import { getMultipleTokenAccounts } from "./utils";

describe("Repay", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
    const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
        program.programId
    );
    const ataTokenA = getAssociatedTokenAddressSync(
        tokenMintA,
        program.provider.publicKey,
        false
    );

    it("should fail when repaying more than owed", async () => {
        const lpVaultBefore = await program.account.lpVault.fetch(lpVaultKey);
        try {
            await program.methods
                .repay(lpVaultBefore.totalBorrowed.addn(1))
                .accounts({
                    mint: tokenMintA,
                    lpVault: lpVaultKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();
        } catch (err) {
            if (err instanceof anchor.AnchorError) {
                assert.equal(err.error.errorCode.number, 6019);
            } else {
                assert.ok(false);
            }
        }
    });

    it("should repay borrowed tokens from lp vault", async () => {
        const lpVaultBefore = await program.account.lpVault.fetch(lpVaultKey);
        const [vaultBefore] = await getMultipleTokenAccounts(
            program.provider.connection,
            [lpVaultBefore.vault],
            TOKEN_PROGRAM_ID
        );
        await program.methods
            .repay(lpVaultBefore.totalBorrowed)
            .accounts({
                mint: tokenMintA,
                lpVault: lpVaultKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
        const lpVaultAfter = await program.account.lpVault.fetch(lpVaultKey);
        const [vaultAfter] = await getMultipleTokenAccounts(
            program.provider.connection,
            [lpVaultBefore.vault],
            TOKEN_PROGRAM_ID
        );
        assert.equal(lpVaultAfter.totalBorrowed.toNumber(), 0);
        assert.equal(
            vaultAfter.amount - vaultBefore.amount,
            BigInt(lpVaultBefore.totalBorrowed.toString())
        );
    });
});
