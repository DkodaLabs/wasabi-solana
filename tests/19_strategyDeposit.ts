import * as anchor from "@coral-xyz/anchor";
import { AccountLayout, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import {
    superAdminProgram,
    tokenMintA,
    tokenMintB,
    BORROW_AUTHORITY,
    NON_BORROW_AUTHORITY,
} from "./rootHooks";
import {
    getAssociatedTokenAddressSync,
    createBurnInstruction,
    createMintToInstruction
} from "@solana/spl-token";

describe("StrategyDeposit", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

    describe("With incorrect permission", () => {
        it("should fail", async () => {
            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                superAdminProgram.programId,
            );

            const vaultAta = getAssociatedTokenAddressSync(
                tokenMintA,
                lpVault,
                true,
                TOKEN_PROGRAM_ID
            );

            const collateralVault = getAssociatedTokenAddressSync(
                tokenMintB,
                lpVault,
                true,
                TOKEN_PROGRAM_ID,
            );

            const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy"), lpVault.toBuffer(), tokenMintB.toBuffer()],
                superAdminProgram.programId,
            );

            const [strategyRequest] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy_request"), strategy.toBuffer()],
                superAdminProgram.programId
            );

            const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), NON_BORROW_AUTHORITY.publicKey.toBuffer()],
                program.programId
            );

            const setupIx = await program.methods.strategyDepositSetup(
                new anchor.BN(100),
                new anchor.BN(100)
            ).accountsPartial({
                authority: NON_BORROW_AUTHORITY.publicKey,
                permission,
                lpVault,
                vault: vaultAta,
                collateral: tokenMintB,
                strategy,
                strategyRequest,
                collateralVault,
                tokenProgram: TOKEN_PROGRAM_ID,
            }).instruction();

            const burnIx = createBurnInstruction(vaultAta, tokenMintA, NON_BORROW_AUTHORITY.publicKey, 100);
            const mintIx = createMintToInstruction(tokenMintB, collateralVault, program.provider.publicKey, 100);

            try {
                await program.methods.strategyDepositCleanup().accountsPartial({
                    authority: NON_BORROW_AUTHORITY.publicKey,
                    //@ts-ignore
                    permission,
                    lpVault: lpVault,
                    vault: vaultAta,
                    collateral: tokenMintB,
                    strategy,
                    strategyRequest,
                    collateralVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                    .preInstructions([setupIx, burnIx, mintIx])
                    .signers([NON_BORROW_AUTHORITY])
                    .rpc();

                assert.ok(false);
            } catch (err) {
                if (err instanceof anchor.AnchorError) {
                    assert.equal(err.error.errorCode.number, 6000);

                } else {
                    assert.ok(false);
                }
            }
        })
    });

    describe("Correct setup", () => {
        it("should deposit into the strategy", async () => {
            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                superAdminProgram.programId,
            );

            const vaultAta = getAssociatedTokenAddressSync(
                tokenMintA,
                lpVault,
                true,
                TOKEN_PROGRAM_ID
            );

            const collateralVault = getAssociatedTokenAddressSync(
                tokenMintB,
                lpVault,
                true,
                TOKEN_PROGRAM_ID,
            );

            const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy"), lpVault.toBuffer(), tokenMintB.toBuffer()],
                superAdminProgram.programId,
            );

            const [strategyRequest] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy_request"), strategy.toBuffer()],
                superAdminProgram.programId
            );

            const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                program.programId
            );

            const [lpVaultBefore, strategyBefore, vaultBefore, collateralVaultBefore] = await Promise.all([
                program.account.lpVault.fetch(lpVault),
                program.account.strategy.fetch(strategy),
                program.provider.connection.getAccountInfo(vaultAta),
                program.provider.connection.getAccountInfo(collateralVault),
            ]);

            const setupIx = await program.methods.strategyDepositSetup(
                new anchor.BN(100),
                new anchor.BN(100)
            ).accountsPartial({
                authority: BORROW_AUTHORITY.publicKey,
                permission,
                lpVault,
                vault: vaultAta,
                collateral: tokenMintB,
                strategy,
                strategyRequest,
                collateralVault,
                tokenProgram: TOKEN_PROGRAM_ID,
            }).instruction();

            const burnIx = createBurnInstruction(vaultAta, tokenMintA, BORROW_AUTHORITY.publicKey, 100);
            const mintIx = createMintToInstruction(tokenMintB, collateralVault, program.provider.publicKey, 100);

            try {
                await program.methods.strategyDepositCleanup().accountsPartial({
                    authority: BORROW_AUTHORITY.publicKey,
                    //@ts-ignore
                    permission,
                    lpVault: lpVault,
                    vault: vaultAta,
                    collateral: tokenMintB,
                    strategy,
                    strategyRequest,
                    collateralVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                    .preInstructions([setupIx, burnIx, mintIx])
                    .signers([BORROW_AUTHORITY])
                    .rpc();

                const [lpVaultAfter, strategyAfter, vaultAfter, collateralVaultAfter] = await Promise.all([
                    program.account.lpVault.fetch(lpVault),
                    program.account.strategy.fetch(strategy),
                    program.provider.connection.getAccountInfo(vaultAta),
                    program.provider.connection.getAccountInfo(collateralVault),
                ]);

                const vaultBeforeData = AccountLayout.decode(vaultBefore.data);
                const vaultAfterData = AccountLayout.decode(vaultAfter.data);
                const collateralVaultBeforeData = AccountLayout.decode(collateralVaultBefore.data);
                const collateralVaultAfterData = AccountLayout.decode(collateralVaultAfter.data);

                assert.equal(
                    lpVaultAfter.totalBorrowed.toNumber(),
                    (lpVaultBefore.totalBorrowed.add(new anchor.BN(100)).toNumber())
                );

                assert.equal(
                    strategyAfter.totalBorrowedAmount.toNumber(),
                    (strategyBefore.totalBorrowedAmount.add(new anchor.BN(100)).toNumber())
                );

                assert.equal(
                    Number(vaultAfterData.amount),
                    Number(vaultBeforeData.amount - BigInt(100))
                );
                assert.equal(
                    Number(collateralVaultAfterData.amount),
                    Number(collateralVaultBeforeData.amount + BigInt(100))
                );
            } catch (err) {
                assert.ok(false);
            }
        })
    });
});
