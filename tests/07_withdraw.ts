import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { tokenMintA } from "./rootHooks";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import { getMultipleMintAccounts, getMultipleTokenAccounts } from "./utils";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

describe("Withdraw", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
    const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
        program.programId
    );
    let lpVault: anchor.IdlAccounts<WasabiSolana>["lpVault"];
    let ownerSharesAccount: anchor.web3.PublicKey;
    const tokenAAta = getAssociatedTokenAddressSync(
        tokenMintA,
        program.provider.publicKey,
        false,
        TOKEN_PROGRAM_ID,
    );

    before(async () => {
        lpVault = await program.account.lpVault.fetch(lpVaultKey);
        ownerSharesAccount = getAssociatedTokenAddressSync(
            lpVault.sharesMint,
            program.provider.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID,
        );
    });

    it("should successfully withdraw", async () => {
        const tokenAmount = new anchor.BN(1_000_000);
        const [
            [ownerTokenABefore, vaultABefore],
            [ownerSharesBefore],
            [sharesMintBefore],
            lpVaultBefore,
        ] = await Promise.all([
            getMultipleTokenAccounts(program.provider.connection, [
                tokenAAta,
                lpVault.vault,
            ], TOKEN_PROGRAM_ID),
            getMultipleTokenAccounts(program.provider.connection, [
                ownerSharesAccount,
            ], TOKEN_2022_PROGRAM_ID),
            getMultipleMintAccounts(program.provider.connection, [
                lpVault.sharesMint,
            ], TOKEN_2022_PROGRAM_ID),
            program.account.lpVault.fetch(lpVaultKey),
        ]);

        // expected to round up, since the program should favor burning
        // more shares rather than less.
        const expectedSharesBurned = tokenAmount
            .mul(new anchor.BN(sharesMintBefore.supply.toString()))
            .add(lpVaultBefore.totalAssets.sub(new anchor.BN(1)))
            .div(lpVaultBefore.totalAssets);

        await program.methods
            .withdraw(tokenAmount)
            .accounts({
                owner: program.provider.publicKey,
                lpVault: lpVaultKey,
                assetMint: tokenMintA,
                assetTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        const [
            [ownerTokenAAfter, vaultAAfter],
            [ownerSharesAfter],
            lpVaultAfter,
            [sharesMintAfter],
        ] = await Promise.all([
            getMultipleTokenAccounts(program.provider.connection, [
                tokenAAta,
                lpVault.vault,
            ], TOKEN_PROGRAM_ID),
            getMultipleTokenAccounts(program.provider.connection, [
                ownerSharesAccount,
            ], TOKEN_2022_PROGRAM_ID),
            program.account.lpVault.fetch(lpVaultKey),
            getMultipleMintAccounts(program.provider.connection, [
                lpVault.sharesMint,
            ], TOKEN_2022_PROGRAM_ID),
        ]);

        // Validate tokens were transfered from the user's account to the vault
        const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
        assert.equal(ownerADiff, BigInt(tokenAmount.toString()));
        const vaultADiff = vaultAAfter.amount - vaultABefore.amount;
        assert.equal(-vaultADiff, BigInt(tokenAmount.toString()));

        // Validate shares were burned from the user's account
        const ownerSharesDiff = ownerSharesAfter.amount - ownerSharesBefore.amount;
        assert.equal(
            ownerSharesDiff,
            BigInt(expectedSharesBurned.neg().toString())
        );
        const sharesSupplyDiff = sharesMintAfter.supply - sharesMintBefore.supply;
        assert.equal(
            sharesSupplyDiff,
            BigInt(expectedSharesBurned.neg().toString())
        );

        // Validate the LpVault total assets was decremented properly
        const lpVaultAssetCountDiff = lpVaultAfter.totalAssets.sub(
            lpVault.totalAssets
        );
        assert.equal(
            BigInt(lpVaultAssetCountDiff.toString()),
            -BigInt(tokenAmount.toString())
        );
    });
});
