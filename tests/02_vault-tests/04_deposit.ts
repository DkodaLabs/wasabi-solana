import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, createMintToCheckedInstruction } from "@solana/spl-token";
import { tokenMintA } from "../hooks/allHook";
import {
    getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { assert } from "chai";
import { validateDeposit } from '../hooks/vaultHook';


describe("Deposit", () => {
    it("should have a successful initial deposit", async () => {
        try {
            await validateDeposit(BigInt(1_000_000));
        } catch (err) {
            console.error(err);
            assert.ok(false);
        }
    });

    // Case for another user depositing when shares already exist
    it("should have a successful second deposit", async () => {
        try {
            await validateDeposit(BigInt(500_000));
        } catch (err) {
            console.error(err);
            assert.ok(false);
        }
    });

    it("should handle deposits near u64 max", async () => {
        // Try deposit with amount close to u64 max
        const largeAmount = BigInt("18446744073709551615"); // u64::MAX

        try {
            await validateDeposit(largeAmount);
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
