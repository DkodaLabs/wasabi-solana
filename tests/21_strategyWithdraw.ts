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

            const collateralAmount = await program.provider.connection.getAccountInfo(collateralVault);
            const partialWithdrawAmount = AccountLayout.decode(collateralAmount.data).amount / BigInt(2);

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

            } catch (err) {
                console.log(err);
                assert.ok(false);
            }

        });
    });
});
