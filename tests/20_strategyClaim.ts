import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import { BORROW_AUTHORITY, tokenMintA, tokenMintB } from "./rootHooks";

describe("StrategyClaim", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

    describe("Correct setup", () => {
        it("should correctly increment strategy and lp_vault balances", async () => {
            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                program.programId,
            );

            const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy"), lpVault.toBuffer(), tokenMintB.toBuffer()],
                program.programId,
            );
            const newQuote = new anchor.BN(101);

            const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                program.programId
            );

            const [strategyBefore, lpVaultBefore] = await Promise.all([
                program.account.strategy.fetch(strategy),
                program.account.lpVault.fetch(lpVault)
            ]);

            try {
                await program.methods.strategyClaimYield(new anchor.BN(newQuote)).accountsPartial({
                    authority: BORROW_AUTHORITY.publicKey,
                    permission,
                    lpVault,
                    collateral: tokenMintB,
                    strategy
                })
                    .signers([BORROW_AUTHORITY])
                    .rpc();

                const [strategyAfter, lpVaultAfter] = await Promise.all([
                    program.account.strategy.fetch(strategy),
                    program.account.lpVault.fetch(lpVault)
                ]);

                assert.equal(
                    strategyAfter.totalBorrowedAmount.toNumber(),
                    strategyBefore.totalBorrowedAmount.addn(1).toNumber()
                );

                assert.equal(
                    lpVaultAfter.totalBorrowed.toNumber(),
                    lpVaultBefore.totalBorrowed.addn(1).toNumber()
                );

            } catch (err) {
                console.log(err);
                assert.ok(false);
            }

        })
        it("should correctly decrement strategy and lp_vault balances when interest is negative", async () => {

            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                program.programId,
            );

            const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy"), lpVault.toBuffer(), tokenMintB.toBuffer()],
                program.programId,
            );

            const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                program.programId
            );

            const [strategyBefore, lpVaultBefore] = await Promise.all([
                program.account.strategy.fetch(strategy),
                program.account.lpVault.fetch(lpVault)
            ]);

            const newQuote = strategyBefore.totalBorrowedAmount.subn(1);

            try {
                await program.methods.strategyClaimYield(new anchor.BN(newQuote)).accountsPartial({
                    authority: BORROW_AUTHORITY.publicKey,
                    permission,
                    lpVault,
                    collateral: tokenMintB,
                    strategy
                })
                    .signers([BORROW_AUTHORITY])
                    .rpc();

                const [strategyAfter, lpVaultAfter] = await Promise.all([
                    program.account.strategy.fetch(strategy),
                    program.account.lpVault.fetch(lpVault)
                ]);

                assert.equal(
                    strategyAfter.totalBorrowedAmount.toNumber(),
                    strategyBefore.totalBorrowedAmount.subn(1).toNumber()
                );

                assert.equal(
                    lpVaultAfter.totalBorrowed.toNumber(),
                    lpVaultBefore.totalBorrowed.subn(1).toNumber()
                );
            } catch (err) {
                console.log(err);
            }
        });
    });

    describe("When the interest deviates too much", () => {
        it("should fail", async () => {
            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                program.programId,
            );

            const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy"), lpVault.toBuffer(), tokenMintB.toBuffer()],
                program.programId,
            );
            const newQuote = new anchor.BN(110);

            const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                program.programId
            );

            try {
                await program.methods.strategyClaimYield(new anchor.BN(newQuote)).accountsPartial({
                    authority: BORROW_AUTHORITY.publicKey,
                    permission,
                    lpVault,
                    collateral: tokenMintB,
                    strategy
                })
                    .signers([BORROW_AUTHORITY])
                    .rpc();

                assert.ok(false);
            } catch (err) {
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6016);
                } else {
                    assert.ok(false);
                }
            }
        });
    });
});
