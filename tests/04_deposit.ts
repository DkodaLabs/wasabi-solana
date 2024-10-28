import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { tokenMintA } from "./rootHooks";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { assert } from "chai";
import { getMultipleMintAccounts, getMultipleTokenAccounts } from "./utils";

describe("Deposit", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
    const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
        program.programId
    );
    let lpVault: anchor.IdlAccounts<WasabiSolana>["lpVault"];
    let ownerSharesAccount: anchor.web3.PublicKey;

    before(async () => {
        lpVault = await program.account.lpVault.fetch(lpVaultKey);
        // Create the user's shares mint accounts
        const tx = new anchor.web3.Transaction();
        ownerSharesAccount = getAssociatedTokenAddressSync(
            lpVault.sharesMint,
            program.provider.publicKey,
            false
        );
        const createAtaIx = createAssociatedTokenAccountInstruction(
            program.provider.publicKey,
            ownerSharesAccount,
            program.provider.publicKey,
            lpVault.sharesMint
        );
        tx.add(createAtaIx);
        await program.provider.sendAndConfirm(tx);
    });

    it("should have a successful initial deposit", async () => {
        const amount = new anchor.BN(1_000_000);
        const tokenAAta = getAssociatedTokenAddressSync(
            tokenMintA,
            program.provider.publicKey,
            false
        );
        const [
            [ownerTokenABefore, vaultABefore, ownerSharesBefore],
            [sharesMintBefore],
        ] = await Promise.all([
            getMultipleTokenAccounts(program.provider.connection, [
                tokenAAta,
                lpVault.vault,
                ownerSharesAccount,
            ]),
            getMultipleMintAccounts(program.provider.connection, [
                lpVault.sharesMint,
            ]),
        ]);
        await program.methods
            .deposit({ amount })
            .accounts({
                owner: program.provider.publicKey,
                lpVault: lpVaultKey,
                assetMint: tokenMintA,
                assetTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        const [
            [ownerTokenAAfter, vaultAAfter, ownerSharesAfter],
            lpVaultAfter,
            [sharesMintAfter],
        ] = await Promise.all([
            getMultipleTokenAccounts(program.provider.connection, [
                tokenAAta,
                lpVault.vault,
                ownerSharesAccount,
            ]),
            program.account.lpVault.fetch(lpVaultKey),
            getMultipleMintAccounts(program.provider.connection, [
                lpVault.sharesMint,
            ]),
        ]);

        // Validate tokens were transfered from the user's account to the vault
        const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
        assert.equal(-ownerADiff, BigInt(amount.toString()));
        const vaultADiff = vaultAAfter.amount - vaultABefore.amount;
        assert.equal(vaultADiff, BigInt(amount.toString()));

        // Validate the LpVault total assets was incremented properly
        const lpVaultAssetCountDiff = lpVaultAfter.totalAssets.sub(
            lpVault.totalAssets
        );
        assert.equal(lpVaultAssetCountDiff.toString(), amount.toString());

        // Validate shares were minted to the user's account
        const ownerSharesDiff = ownerSharesAfter.amount - ownerSharesBefore.amount;
        assert.equal(ownerSharesDiff, BigInt(amount.toString()));
        const sharesSupplyDiff = sharesMintAfter.supply - sharesMintBefore.supply;
        assert.equal(sharesSupplyDiff, BigInt(amount.toString()));
    });

    // Case for another user depositing when shares already exist
    it("should have a successful second deposit", async () => {
        const amount = new anchor.BN(2_000_000);
        const tokenAAta = getAssociatedTokenAddressSync(
            tokenMintA,
            program.provider.publicKey,
            false
        );
        const [
            [ownerTokenABefore, vaultABefore, ownerSharesBefore],
            [sharesMintBefore],
            lpVaultBefore,
        ] = await Promise.all([
            getMultipleTokenAccounts(program.provider.connection, [
                tokenAAta,
                lpVault.vault,
                ownerSharesAccount,
            ]),
            getMultipleMintAccounts(program.provider.connection, [
                lpVault.sharesMint,
            ]),
            program.account.lpVault.fetch(lpVaultKey),
        ]);

        const expectedSharesAmount =
            (sharesMintBefore.supply * BigInt(amount.toString())) /
            BigInt(lpVaultBefore.totalAssets.toString());
        await program.methods
            .deposit({ amount })
            .accounts({
                owner: program.provider.publicKey,
                lpVault: lpVaultKey,
                assetMint: tokenMintA,
                assetTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        const [
            [ownerTokenAAfter, vaultAAfter, ownerSharesAfter],
            lpVaultAfter,
            [sharesMintAfter],
        ] = await Promise.all([
            getMultipleTokenAccounts(program.provider.connection, [
                tokenAAta,
                lpVault.vault,
                ownerSharesAccount,
            ]),
            program.account.lpVault.fetch(lpVaultKey),
            getMultipleMintAccounts(program.provider.connection, [
                lpVault.sharesMint,
            ]),
        ]);

        // Validate tokens were transfered from the user's account to the vault
        const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
        assert.equal(-ownerADiff, BigInt(amount.toString()));
        const vaultADiff = vaultAAfter.amount - vaultABefore.amount;
        assert.equal(vaultADiff, BigInt(amount.toString()));

        // Validate the LpVault total assets was incremented properly
        const lpVaultAssetCountDiff = lpVaultAfter.totalAssets.sub(
            lpVaultBefore.totalAssets
        );
        assert.equal(lpVaultAssetCountDiff.toString(), amount.toString());

        // Validate shares were minted to the user's account
        const ownerSharesDiff = ownerSharesAfter.amount - ownerSharesBefore.amount;
        assert.equal(ownerSharesDiff, BigInt(expectedSharesAmount.toString()));
        const sharesSupplyDiff = sharesMintAfter.supply - sharesMintBefore.supply;
        assert.equal(sharesSupplyDiff, BigInt(expectedSharesAmount.toString()));
    });

    it("should not allow a user to withdraw more than deposited", async () => {
        const totalDeposits = 100;
        const amount = new anchor.BN(2_000_000);
        const tokenAAta = getAssociatedTokenAddressSync(
            tokenMintA,
            program.provider.publicKey,
            false
        );
        const [[ownerTokenABefore, ownerSharesBefore]] = await Promise.all([
            getMultipleTokenAccounts(program.provider.connection, [
                tokenAAta,
                ownerSharesAccount,
            ]),
        ]);

        for (let i = 0; i < totalDeposits; i++) {
            await program.methods
                .deposit({ amount })
                .accounts({
                    owner: program.provider.publicKey,
                    lpVault: lpVaultKey,
                    assetMint: tokenMintA,
                    assetTokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();
        }

        for (let j = 0; j < totalDeposits; j++) {
            await program.methods
                .withdraw({ amount })
                .accounts({
                    owner: program.provider.publicKey,
                    lpVault: lpVaultKey,
                    assetMint: tokenMintA,
                    assetTokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();
        }

        const [
            [ownerTokenAAfter, ownerSharesAfter],
        ] = await Promise.all([
            getMultipleTokenAccounts(program.provider.connection, [
                tokenAAta,
                ownerSharesAccount,
            ]),
        ]);

        // Assert user has less than or equal to the amount of shares prior
        assert.ok(ownerSharesAfter.amount <= ownerSharesBefore.amount);
        // Assert user has less than or equal to the amount of tokens prior
        assert.ok(ownerTokenAAfter.amount <= ownerTokenABefore.amount);
    });
});
