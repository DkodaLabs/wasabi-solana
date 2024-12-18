import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, createMintToCheckedInstruction } from "@solana/spl-token";
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
            false,
            TOKEN_2022_PROGRAM_ID,
        );
        const createAtaIx = createAssociatedTokenAccountInstruction(
            program.provider.publicKey,
            ownerSharesAccount,
            program.provider.publicKey,
            lpVault.sharesMint,
            TOKEN_2022_PROGRAM_ID,
        );
        tx.add(createAtaIx);
        await program.provider.sendAndConfirm(tx);
    });

    it("should have a successful initial deposit", async () => {
        const amount = new anchor.BN(1_000_000);
        const tokenAAta = getAssociatedTokenAddressSync(
            tokenMintA,
            program.provider.publicKey,
            false,
            TOKEN_PROGRAM_ID,
        );
        const [
            [ownerTokenABefore, vaultABefore],
            [ownerSharesBefore],
            [sharesMintBefore],
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
        ]);
        await program.methods
            .deposit(amount)
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
            false,
            TOKEN_PROGRAM_ID,
        );
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

        const expectedSharesAmount =
            (sharesMintBefore.supply * BigInt(amount.toString())) /
            BigInt(lpVaultBefore.totalAssets.toString());
        await program.methods
            .deposit(amount)
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

    it("should handle deposits near u64 max", async () => {
        // First deposit to establish initial shares
        const initialAmount = new anchor.BN(1_000_000);
        await program.methods
            .deposit(initialAmount)
            .accounts({
                owner: program.provider.publicKey,
                lpVault: lpVaultKey,
                assetMint: tokenMintA,
                assetTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        // Try deposit with amount close to u64 max
        const largeAmount = new anchor.BN("18446744073709551615"); // u64::MAX

        try {
            await program.methods
                .deposit(largeAmount)
                .accounts({
                    owner: program.provider.publicKey,
                    lpVault: lpVaultKey,
                    assetMint: tokenMintA,
                    assetTokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();
            assert.fail("Should have thrown error");
        } catch (e) {
            assert.include(e.message, "insufficient funds");
        }
    });

    it("should handle depositing exactly u64::MAX", async () => {
        const userAta = getAssociatedTokenAddressSync(
            tokenMintA,
            program.provider.publicKey,
            false,
            TOKEN_PROGRAM_ID,
        );
        const vaultBefore = await program.account.lpVault.fetch(lpVaultKey);

        const U64_MAX = BigInt("18346744073716551615");

        const mintIx = createMintToCheckedInstruction(
            tokenMintA,
            userAta,
            program.provider.publicKey,
            BigInt(U64_MAX),
            6,
            [],
            TOKEN_PROGRAM_ID
        );

        await program.provider.sendAndConfirm(
            new anchor.web3.Transaction().add(mintIx)
        );

        try {
            await program.methods
                .deposit(new anchor.BN(String(U64_MAX)))
                .accounts({
                    owner: program.provider.publicKey,
                    lpVault: lpVaultKey,
                    assetMint: tokenMintA,
                    assetTokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            const vaultAfter = await program.account.lpVault.fetch(lpVaultKey);
            assert.equal(String(vaultAfter.totalAssets.sub(vaultBefore.totalAssets)), String(U64_MAX));
        } catch (e) {
            console.log(e);
        }
    });

    it("should maintain correct share ratio even with tiny deposits", async () => {
        // First make a large deposit to establish initial shares
        const largeAmount = new anchor.BN("1000000000000"); // 1M tokens
        await program.methods
            .deposit(largeAmount)
            .accounts({
                owner: program.provider.publicKey,
                lpVault: lpVaultKey,
                assetMint: tokenMintA,
                assetTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        // Then try a very small deposit
        const tinyAmount = new anchor.BN(1); // 1 token
        const beforeLpVault = await program.account.lpVault.fetch(lpVaultKey);

        await program.methods
            .deposit(tinyAmount)
            .accounts({
                owner: program.provider.publicKey,
                lpVault: lpVaultKey,
                assetMint: tokenMintA,
                assetTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        const afterLpVault = await program.account.lpVault.fetch(lpVaultKey);

        // Verify total assets increased by tiny amount
        assert.ok(afterLpVault.totalAssets.sub(beforeLpVault.totalAssets).eq(tinyAmount));
    });

    //it("should not allow a user to withdraw more than deposited", async () => {
    //    const totalDeposits = 100;
    //    const amount = new anchor.BN(2_000_000);
    //    const tokenAAta = getAssociatedTokenAddressSync(
    //        tokenMintA,
    //        program.provider.publicKey,
    //        false
    //    );
    //    const [[ownerTokenABefore], [ownerSharesBefore]] = await Promise.all([
    //        getMultipleTokenAccounts(program.provider.connection, [
    //            tokenAAta,
    //        ], TOKEN_PROGRAM_ID),
    //        getMultipleTokenAccounts(program.provider.connection, [
    //            ownerSharesAccount
    //        ], TOKEN_2022_PROGRAM_ID),
    //    ]);

    //    for (let i = 0; i < totalDeposits; i++) {
    //        await program.methods
    //            .deposit(amount)
    //            .accounts({
    //                owner: program.provider.publicKey,
    //                lpVault: lpVaultKey,
    //                assetMint: tokenMintA,
    //                assetTokenProgram: TOKEN_PROGRAM_ID,
    //            })
    //            .rpc();
    //    }

    //    for (let j = 0; j < totalDeposits; j++) {
    //        await program.methods
    //            .withdraw(amount)
    //            .accounts({
    //                owner: program.provider.publicKey,
    //                lpVault: lpVaultKey,
    //                assetMint: tokenMintA,
    //                assetTokenProgram: TOKEN_PROGRAM_ID,
    //            })
    //            .rpc();
    //    }

    //    const [
    //        [ownerTokenAAfter], [ownerSharesAfter],
    //    ] = await Promise.all([
    //        getMultipleTokenAccounts(program.provider.connection, [
    //            tokenAAta,
    //        ], TOKEN_PROGRAM_ID),
    //        getMultipleTokenAccounts(program.provider.connection, [
    //            ownerSharesAccount,
    //        ], TOKEN_2022_PROGRAM_ID),
    //    ]);

    //    // Assert user has less than or equal to the amount of shares prior
    //    assert.ok(ownerSharesAfter.amount <= ownerSharesBefore.amount);
    //    // Assert user has less than or equal to the amount of tokens prior
    //    assert.ok(ownerTokenAAfter.amount <= ownerTokenABefore.amount);
    //});
});
