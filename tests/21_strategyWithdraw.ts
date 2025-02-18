import * as anchor from "@coral-xyz/anchor";
import { AccountLayout, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import { tokenMintA, tokenMintB, BORROW_AUTHORITY } from "./rootHooks";
import {
    getAssociatedTokenAddressSync,
    createMintToInstruction,
    createBurnInstruction
} from "@solana/spl-token";

describe("StrategyWithdraw", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

    describe("Interest deviates too much", () => {
        it("should fail", async () => {

            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                program.programId,
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
                program.programId,
            );

            const [strategyRequest] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy_request"), strategy.toBuffer()],
                program.programId
            );

            const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                program.programId
            );

            const collateralAmount = await program.provider.connection.getAccountInfo(collateralVault);
            const fullWithdrawAmount = AccountLayout.decode(collateralAmount.data).amount;

            const setupIx = await program.methods.strategyWithdrawSetup(
                new anchor.BN(Number(fullWithdrawAmount)),
                new anchor.BN(Number(fullWithdrawAmount))
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

            const burnIx = createBurnInstruction(collateralVault, tokenMintB, BORROW_AUTHORITY.publicKey, fullWithdrawAmount);
            const mintIx = createMintToInstruction(tokenMintA, vaultAta, program.provider.publicKey, fullWithdrawAmount + BigInt(100));

            try {
                await program.methods.strategyWithdrawCleanup().accountsPartial({
                    authority: BORROW_AUTHORITY.publicKey,
                    permission,
                    lpVault,
                    vault: vaultAta,
                    collateral: tokenMintB,
                    strategy,
                    strategyRequest,
                    collateralVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    wasabiProgram: program.programId,
                })
                    .preInstructions([setupIx, burnIx, mintIx])
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
    })

    describe("Partial withdraw", () => {
        it("should withdraw a partial amount from the strategy and update strategy / lp_vault accounts", async () => {
            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                program.programId,
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
                program.programId,
            );

            const [strategyRequest] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy_request"), strategy.toBuffer()],
                program.programId
            );

            const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                program.programId
            );

            const [strategyBefore, lpVaultBefore, collateralVaultBefore, vaultBefore] = await Promise.all([
                program.account.strategy.fetch(strategy),
                program.account.lpVault.fetch(lpVault),
                program.provider.connection.getAccountInfo(collateralVault),
                program.provider.connection.getAccountInfo(vaultAta),
            ]);

            const collateralVaultBeforeData = AccountLayout.decode(collateralVaultBefore.data);
            const collateralBeforeAmount = collateralVaultBeforeData.amount;

            const vaultBeforeData = AccountLayout.decode(vaultBefore.data);

            const partialWithdrawAmount = Math.floor(Number(collateralBeforeAmount) / 2);

            const setupIx = await program.methods.strategyWithdrawSetup(
                new anchor.BN(partialWithdrawAmount),
                new anchor.BN(partialWithdrawAmount)
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

            const burnIx = createBurnInstruction(collateralVault, tokenMintB, BORROW_AUTHORITY.publicKey, partialWithdrawAmount);
            const mintIx = createMintToInstruction(tokenMintA, vaultAta, program.provider.publicKey, partialWithdrawAmount);

            try {
                await program.methods.strategyWithdrawCleanup().accountsPartial({
                    authority: BORROW_AUTHORITY.publicKey,
                    permission,
                    lpVault,
                    vault: vaultAta,
                    collateral: tokenMintB,
                    strategy,
                    strategyRequest,
                    collateralVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    wasabiProgram: program.programId,
                })
                    .preInstructions([setupIx, burnIx, mintIx])
                    .signers([BORROW_AUTHORITY])
                    .rpc();

                const [strategyAfter, lpVaultAfter, collateralVaultAfter, vaultAfter] = await Promise.all([
                    program.account.strategy.fetch(strategy),
                    program.account.lpVault.fetch(lpVault),
                    program.provider.connection.getAccountInfo(collateralVault),
                    program.provider.connection.getAccountInfo(vaultAta),
                ]);

                const collateralVaultAfterData = AccountLayout.decode(collateralVaultAfter.data);
                const vaultAfterData = AccountLayout.decode(vaultAfter.data);

                const vaultDiff = new anchor.BN(vaultAfterData.amount.toString())
                    .sub(new anchor.BN(vaultBeforeData.amount.toString()));

                const lpVaultDiff = lpVaultBefore.totalBorrowed.sub(lpVaultAfter.totalBorrowed);

                const collateralVaultDiff = new anchor.BN(collateralVaultBeforeData.amount.toString())
                    .sub(new anchor.BN(collateralVaultAfterData.amount.toString()));

                const strategyDiff = strategyBefore.totalBorrowedAmount
                    .sub(strategyAfter.totalBorrowedAmount);

                assert.equal(
                    lpVaultDiff.toString(),
                    new anchor.BN(partialWithdrawAmount.toString()).toString(),
                    "LP vault diff mismatch"
                );
                assert.equal(
                    strategyAfter.totalBorrowedAmount.toString(),
                    "150",
                    "Strategy borrowed amount should be 150"
                );
                assert.equal(
                    strategyDiff.toString(),
                    new anchor.BN(partialWithdrawAmount.toString()).toString(),
                    "Strategy diff mismatch"
                );
                assert.equal(
                    collateralVaultDiff.toString(),
                    new anchor.BN(partialWithdrawAmount.toString()).toString(),
                    "Collateral vault diff mismatch"
                );
                assert.equal(
                    vaultDiff.toString(),
                    new anchor.BN(partialWithdrawAmount.toString()).toString(),
                    "Vault diff mismatch"
                );
            } catch (err) {
                console.log(err);
                assert.ok(false);
            }
        });
    });

    describe("Full withdraw", () => {
        it("should withdraw the full amount from the strategy", async () => {
            const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                program.programId,
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
                program.programId,
            );

            const [strategyRequest] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("strategy_request"), strategy.toBuffer()],
                program.programId
            );

            const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                program.programId
            );

            const [strategyBefore, lpVaultBefore, collateralVaultBefore, vaultBefore] = await Promise.all([
                program.account.strategy.fetch(strategy),
                program.account.lpVault.fetch(lpVault),
                program.provider.connection.getAccountInfo(collateralVault),
                program.provider.connection.getAccountInfo(vaultAta),
            ]);

            const collateralVaultBeforeData = AccountLayout.decode(collateralVaultBefore.data);
            const vaultBeforeData = AccountLayout.decode(vaultBefore.data);

            const fullWithdrawAmount = collateralVaultBeforeData.amount;

            const setupIx = await program.methods.strategyWithdrawSetup(
                new anchor.BN(Number(fullWithdrawAmount)),
                new anchor.BN(Number(fullWithdrawAmount))
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

            const burnIx = createBurnInstruction(collateralVault, tokenMintB, BORROW_AUTHORITY.publicKey, fullWithdrawAmount);
            const mintIx = createMintToInstruction(tokenMintA, vaultAta, program.provider.publicKey, fullWithdrawAmount);

            try {
                await program.methods.strategyWithdrawCleanup().accountsPartial({
                    authority: BORROW_AUTHORITY.publicKey,
                    permission,
                    lpVault,
                    vault: vaultAta,
                    collateral: tokenMintB,
                    strategy,
                    strategyRequest,
                    collateralVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    wasabiProgram: program.programId,
                })
                    .preInstructions([setupIx, burnIx, mintIx])
                    .signers([BORROW_AUTHORITY])
                    .rpc();

                const [strategyAfter, lpVaultAfter, collateralVaultAfter, vaultAfter] = await Promise.all([
                    program.account.strategy.fetch(strategy),
                    program.account.lpVault.fetch(lpVault),
                    program.provider.connection.getAccountInfo(collateralVault),
                    program.provider.connection.getAccountInfo(vaultAta),
                ]);

                const collateralVaultAfterData = AccountLayout.decode(collateralVaultAfter.data);
                const vaultAfterData = AccountLayout.decode(vaultAfter.data);

                const lpVaultDiff = lpVaultAfter.totalBorrowed.sub(lpVaultBefore.totalBorrowed).abs();
                const vaultDiff = new anchor.BN(vaultAfterData.amount.toString()).sub(new anchor.BN(vaultBeforeData.amount.toString()));
                const collateralVaultDiff = new anchor.BN(collateralVaultAfterData.amount.toString()).sub(new anchor.BN(collateralVaultBeforeData.amount.toString()));
                const strategyDiff = strategyAfter.totalBorrowedAmount.sub(strategyBefore.totalBorrowedAmount);

                assert.equal(
                    lpVaultDiff.toString(),
                    new anchor.BN(fullWithdrawAmount.toString()).toString(),
                    "LP vault diff mismatch"
                );
                assert.equal(
                    strategyAfter.totalBorrowedAmount.toString(),
                    "0",
                    "Strategy borrowed amount should be 0"
                );
                assert.equal(
                    strategyDiff.toString(),
                    new anchor.BN(fullWithdrawAmount.toString()).neg().toString(),
                    "Strategy diff mismatch"
                );
                assert.equal(
                    collateralVaultDiff.toString(),
                    new anchor.BN(fullWithdrawAmount.toString()).neg().toString(),
                    "Collateral vault diff mismatch"
                );
                assert.equal(
                    vaultDiff.toString(),
                    new anchor.BN(fullWithdrawAmount.toString()).toString(),
                    "Vault diff mismatch"
                );

            } catch (err) {
                console.log(err);
                assert.ok(false);
            }
        });
    });

    beforeEach(async () => {
        const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
            program.programId,
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
            program.programId,
        );

        const [strategyRequest] = anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("strategy_request"), strategy.toBuffer()],
            program.programId
        );

        const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
            program.programId
        );

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
        } catch (err) {
            console.log(err);
            assert.ok(false);
        }
    });


    describe("When the amount received is greater than expected", () => {
        describe("Partial withdraw", () => {
            it("should succeed", async () => {
                const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                    program.programId,
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
                    program.programId,
                );

                const [strategyRequest] = anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("strategy_request"), strategy.toBuffer()],
                    program.programId
                );

                const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                    program.programId
                );

                const [strategyBefore, lpVaultBefore, collateralVaultBefore, vaultBefore] = await Promise.all([
                    program.account.strategy.fetch(strategy),
                    program.account.lpVault.fetch(lpVault),
                    program.provider.connection.getAccountInfo(collateralVault),
                    program.provider.connection.getAccountInfo(vaultAta),
                ]);

                const collateralVaultBeforeData = AccountLayout.decode(collateralVaultBefore.data);
                const vaultBeforeData = AccountLayout.decode(vaultBefore.data);

                const fullWithdrawAmount = collateralVaultBeforeData.amount;
                const partialWithdrawAmount = (fullWithdrawAmount / BigInt(2));

                const setupIx = await program.methods.strategyWithdrawSetup(
                    new anchor.BN(Number(partialWithdrawAmount)),
                    new anchor.BN(Number(partialWithdrawAmount))
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

                const burnIx = createBurnInstruction(collateralVault, tokenMintB, BORROW_AUTHORITY.publicKey, partialWithdrawAmount);
                const mintIx = createMintToInstruction(tokenMintA, vaultAta, program.provider.publicKey, partialWithdrawAmount);

                try {
                    await program.methods.strategyWithdrawCleanup().accountsPartial({
                        authority: BORROW_AUTHORITY.publicKey,
                        permission,
                        lpVault,
                        vault: vaultAta,
                        collateral: tokenMintB,
                        strategy,
                        strategyRequest,
                        collateralVault,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        wasabiProgram: program.programId,
                    })
                        .preInstructions([setupIx, burnIx, mintIx])
                        .signers([BORROW_AUTHORITY])
                        .rpc();

                    const [strategyAfter, lpVaultAfter, collateralVaultAfter, vaultAfter] = await Promise.all([
                        program.account.strategy.fetch(strategy),
                        program.account.lpVault.fetch(lpVault),
                        program.provider.connection.getAccountInfo(collateralVault),
                        program.provider.connection.getAccountInfo(vaultAta),
                    ]);

                    const collateralVaultAfterData = AccountLayout.decode(collateralVaultAfter.data);
                    const vaultAfterData = AccountLayout.decode(vaultAfter.data);

                    const lpVaultDiff = lpVaultAfter.totalBorrowed.sub(lpVaultBefore.totalBorrowed).abs();
                    const vaultDiff = new anchor.BN(vaultAfterData.amount.toString()).sub(new anchor.BN(vaultBeforeData.amount.toString()));
                    const collateralVaultDiff = new anchor.BN(collateralVaultAfterData.amount.toString()).sub(new anchor.BN(collateralVaultBeforeData.amount.toString()));
                    const strategyDiff = strategyAfter.totalBorrowedAmount.sub(strategyBefore.totalBorrowedAmount);

                    assert.equal(
                        lpVaultDiff.toString(),
                        new anchor.BN(partialWithdrawAmount.toString()).toString(),
                        "LP vault diff mismatch"
                    );
                    assert.equal(
                        strategyDiff.toString(),
                        new anchor.BN(partialWithdrawAmount.toString()).neg().toString(),
                        "Strategy diff mismatch"
                    );
                    assert.equal(
                        collateralVaultDiff.toString(),
                        new anchor.BN(partialWithdrawAmount.toString()).neg().toString(),
                        "Collateral vault diff mismatch"
                    );
                    assert.equal(
                        vaultDiff.toString(),
                        new anchor.BN(partialWithdrawAmount.toString()).toString(),
                        "Vault diff mismatch"
                    );
                } catch (err) {
                    console.log(err);
                    assert.ok(false);
                }
            });
        });
        describe("Full withdraw", () => {
            it("should succeed if within threshold, and should update lp_vault and strategy accordingly", async () => {
                const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                    program.programId,
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
                    program.programId,
                );

                const [strategyRequest] = anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("strategy_request"), strategy.toBuffer()],
                    program.programId
                );

                const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                    program.programId
                );

                const [strategyBefore, lpVaultBefore, collateralVaultBefore, vaultBefore] = await Promise.all([
                    program.account.strategy.fetch(strategy),
                    program.account.lpVault.fetch(lpVault),
                    program.provider.connection.getAccountInfo(collateralVault),
                    program.provider.connection.getAccountInfo(vaultAta),
                ]);

                const collateralVaultBeforeData = AccountLayout.decode(collateralVaultBefore.data);
                const vaultBeforeData = AccountLayout.decode(vaultBefore.data);

                const fullWithdrawAmount = collateralVaultBeforeData.amount;

                const setupIx = await program.methods.strategyWithdrawSetup(
                    new anchor.BN(Number(fullWithdrawAmount)),
                    new anchor.BN(Number(fullWithdrawAmount))
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

                const burnIx = createBurnInstruction(collateralVault, tokenMintB, BORROW_AUTHORITY.publicKey, fullWithdrawAmount);
                const mintIx = createMintToInstruction(tokenMintA, vaultAta, program.provider.publicKey, fullWithdrawAmount);

                try {
                    await program.methods.strategyWithdrawCleanup().accountsPartial({
                        authority: BORROW_AUTHORITY.publicKey,
                        permission,
                        lpVault,
                        vault: vaultAta,
                        collateral: tokenMintB,
                        strategy,
                        strategyRequest,
                        collateralVault,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        wasabiProgram: program.programId,
                    })
                        .preInstructions([setupIx, burnIx, mintIx])
                        .signers([BORROW_AUTHORITY])
                        .rpc();

                    const [strategyAfter, lpVaultAfter, collateralVaultAfter, vaultAfter] = await Promise.all([
                        program.account.strategy.fetch(strategy),
                        program.account.lpVault.fetch(lpVault),
                        program.provider.connection.getAccountInfo(collateralVault),
                        program.provider.connection.getAccountInfo(vaultAta),
                    ]);

                    const collateralVaultAfterData = AccountLayout.decode(collateralVaultAfter.data);
                    const vaultAfterData = AccountLayout.decode(vaultAfter.data);

                    const lpVaultDiff = lpVaultAfter.totalBorrowed.sub(lpVaultBefore.totalBorrowed).abs();
                    const vaultDiff = new anchor.BN(vaultAfterData.amount.toString()).sub(new anchor.BN(vaultBeforeData.amount.toString()));
                    const collateralVaultDiff = new anchor.BN(collateralVaultAfterData.amount.toString()).sub(new anchor.BN(collateralVaultBeforeData.amount.toString()));
                    const strategyDiff = strategyAfter.totalBorrowedAmount.sub(strategyBefore.totalBorrowedAmount);

                    assert.equal(
                        lpVaultDiff.toString(),
                        new anchor.BN(fullWithdrawAmount.toString()).toString(),
                        "LP vault diff mismatch"
                    );
                    assert.equal(
                        strategyAfter.totalBorrowedAmount.toString(),
                        "0",
                        "Strategy borrowed amount should be 0"
                    );
                    assert.equal(
                        strategyDiff.toString(),
                        new anchor.BN(fullWithdrawAmount.toString()).neg().toString(),
                        "Strategy diff mismatch"
                    );
                    assert.equal(
                        collateralVaultDiff.toString(),
                        new anchor.BN(fullWithdrawAmount.toString()).neg().toString(),
                        "Collateral vault diff mismatch"
                    );
                    assert.equal(
                        vaultDiff.toString(),
                        new anchor.BN(fullWithdrawAmount.toString()).toString(),
                        "Vault diff mismatch"
                    );
                } catch (err) {
                    console.log(err);
                    assert.ok(false);
                }
            });
        });
    });

    describe("When the amount received is less than expected", () => {
        describe("Partial withdraw", () => {
            it("should suceed", async () => {
                const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                    program.programId,
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
                    program.programId,
                );

                const [strategyRequest] = anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("strategy_request"), strategy.toBuffer()],
                    program.programId
                );

                const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                    program.programId
                );

                const [strategyBefore, lpVaultBefore, collateralVaultBefore, vaultBefore] = await Promise.all([
                    program.account.strategy.fetch(strategy),
                    program.account.lpVault.fetch(lpVault),
                    program.provider.connection.getAccountInfo(collateralVault),
                    program.provider.connection.getAccountInfo(vaultAta),
                ]);

                const collateralVaultBeforeData = AccountLayout.decode(collateralVaultBefore.data);
                const vaultBeforeData = AccountLayout.decode(vaultBefore.data);

                const partialWithdrawAmount = collateralVaultBeforeData.amount / BigInt(2);

                const setupIx = await program.methods.strategyWithdrawSetup(
                    new anchor.BN(Number(partialWithdrawAmount)),
                    new anchor.BN(Number(partialWithdrawAmount))
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

                const burnIx = createBurnInstruction(collateralVault, tokenMintB, BORROW_AUTHORITY.publicKey, partialWithdrawAmount);
                const mintIx = createMintToInstruction(tokenMintA, vaultAta, program.provider.publicKey, partialWithdrawAmount);

                try {
                    await program.methods.strategyWithdrawCleanup().accountsPartial({
                        authority: BORROW_AUTHORITY.publicKey,
                        permission,
                        lpVault,
                        vault: vaultAta,
                        collateral: tokenMintB,
                        strategy,
                        strategyRequest,
                        collateralVault,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        wasabiProgram: program.programId,
                    })
                        .preInstructions([setupIx, burnIx, mintIx])
                        .signers([BORROW_AUTHORITY])
                        .rpc();

                    const [strategyAfter, lpVaultAfter, collateralVaultAfter, vaultAfter] = await Promise.all([
                        program.account.strategy.fetch(strategy),
                        program.account.lpVault.fetch(lpVault),
                        program.provider.connection.getAccountInfo(collateralVault),
                        program.provider.connection.getAccountInfo(vaultAta),
                    ]);

                    const collateralVaultAfterData = AccountLayout.decode(collateralVaultAfter.data);
                    const vaultAfterData = AccountLayout.decode(vaultAfter.data);

                    const lpVaultDiff = lpVaultAfter.totalBorrowed.sub(lpVaultBefore.totalBorrowed).abs();
                    const vaultDiff = new anchor.BN(vaultAfterData.amount.toString()).sub(new anchor.BN(vaultBeforeData.amount.toString()));
                    const collateralVaultDiff = new anchor.BN(collateralVaultAfterData.amount.toString()).sub(new anchor.BN(collateralVaultBeforeData.amount.toString()));
                    const strategyDiff = strategyAfter.totalBorrowedAmount.sub(strategyBefore.totalBorrowedAmount);

                    assert.equal(
                        lpVaultDiff.toString(),
                        new anchor.BN(partialWithdrawAmount.toString()).toString(),
                        "LP vault diff mismatch"
                    );
                    assert.equal(
                        strategyAfter.totalBorrowedAmount.toString(),
                        "50",
                        "Strategy borrowed amount should be 50"
                    );
                    assert.equal(
                        strategyDiff.toString(),
                        new anchor.BN(partialWithdrawAmount.toString()).neg().toString(),
                        "Strategy diff mismatch"
                    );
                    assert.equal(
                        collateralVaultDiff.toString(),
                        new anchor.BN(partialWithdrawAmount.toString()).neg().toString(),
                        "Collateral vault diff mismatch"
                    );
                    assert.equal(
                        vaultDiff.toString(),
                        new anchor.BN(partialWithdrawAmount.toString()).toString(),
                        "Vault diff mismatch"
                    );
                } catch (err) {
                    console.log(err);
                    assert.ok(false);
                }
            });
        })
        describe("Full withdraw", () => {
            it("should succeed", async () => {
                const [lpVault] = anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
                    program.programId,
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
                    program.programId,
                );

                const [strategyRequest] = anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("strategy_request"), strategy.toBuffer()],
                    program.programId
                );

                const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
                    [anchor.utils.bytes.utf8.encode("admin"), BORROW_AUTHORITY.publicKey.toBuffer()],
                    program.programId
                );

                const [strategyBefore, lpVaultBefore, collateralVaultBefore, vaultBefore] = await Promise.all([
                    program.account.strategy.fetch(strategy),
                    program.account.lpVault.fetch(lpVault),
                    program.provider.connection.getAccountInfo(collateralVault),
                    program.provider.connection.getAccountInfo(vaultAta),
                ]);

                const collateralVaultBeforeData = AccountLayout.decode(collateralVaultBefore.data);
                const vaultBeforeData = AccountLayout.decode(vaultBefore.data);

                const fullWithdrawAmount = collateralVaultBeforeData.amount;

                const setupIx = await program.methods.strategyWithdrawSetup(
                    new anchor.BN(Number(fullWithdrawAmount)),
                    new anchor.BN(Number(fullWithdrawAmount))
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

                const burnIx = createBurnInstruction(collateralVault, tokenMintB, BORROW_AUTHORITY.publicKey, fullWithdrawAmount);
                const mintIx = createMintToInstruction(tokenMintA, vaultAta, program.provider.publicKey, fullWithdrawAmount);

                try {
                    await program.methods.strategyWithdrawCleanup().accountsPartial({
                        authority: BORROW_AUTHORITY.publicKey,
                        permission,
                        lpVault,
                        vault: vaultAta,
                        collateral: tokenMintB,
                        strategy,
                        strategyRequest,
                        collateralVault,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        wasabiProgram: program.programId,
                    })
                        .preInstructions([setupIx, burnIx, mintIx])
                        .signers([BORROW_AUTHORITY])
                        .rpc();

                    const [strategyAfter, lpVaultAfter, collateralVaultAfter, vaultAfter] = await Promise.all([
                        program.account.strategy.fetch(strategy),
                        program.account.lpVault.fetch(lpVault),
                        program.provider.connection.getAccountInfo(collateralVault),
                        program.provider.connection.getAccountInfo(vaultAta),
                    ]);

                    const collateralVaultAfterData = AccountLayout.decode(collateralVaultAfter.data);
                    const vaultAfterData = AccountLayout.decode(vaultAfter.data);

                    const lpVaultDiff = lpVaultAfter.totalBorrowed.sub(lpVaultBefore.totalBorrowed).abs();
                    const vaultDiff = new anchor.BN(vaultAfterData.amount.toString()).sub(new anchor.BN(vaultBeforeData.amount.toString()));
                    const collateralVaultDiff = new anchor.BN(collateralVaultAfterData.amount.toString()).sub(new anchor.BN(collateralVaultBeforeData.amount.toString()));
                    const strategyDiff = strategyAfter.totalBorrowedAmount.sub(strategyBefore.totalBorrowedAmount);

                    assert.equal(
                        lpVaultDiff.toString(),
                        new anchor.BN(fullWithdrawAmount.toString()).toString(),
                        "LP vault diff mismatch"
                    );
                    assert.equal(
                        strategyAfter.totalBorrowedAmount.toString(),
                        "0",
                        "Strategy borrowed amount should be 0"
                    );
                    assert.equal(
                        strategyDiff.toString(),
                        new anchor.BN(fullWithdrawAmount.toString()).neg().toString(),
                        "Strategy diff mismatch"
                    );
                    assert.equal(
                        collateralVaultDiff.toString(),
                        new anchor.BN(fullWithdrawAmount.toString()).neg().toString(),
                        "Collateral vault diff mismatch"
                    );
                    assert.equal(
                        vaultDiff.toString(),
                        new anchor.BN(fullWithdrawAmount.toString()).toString(),
                        "Vault diff mismatch"
                    );
                } catch (err) {
                    console.log(err);
                    assert.ok(false);
                }
            });
        })
    })
});
