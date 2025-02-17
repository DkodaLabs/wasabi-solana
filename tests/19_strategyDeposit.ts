import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import {
    superAdminProgram,
    tokenMintA,
    tokenMintB,
    SWAP_AUTHORITY,
    NON_SWAP_AUTHORITY
} from "./rootHooks";
import {
    getAssociatedTokenAddressSync,
    createBurnInstruction,
    createMintToInstruction
} from "@solana/spl-token";

describe("StrategyDeposit", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

    const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            program.programId
        );

    describe("With incorrect permission", () => {
        it("should fail", async () => {
        });
    })

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

            const setupIx = await program.methods.strategyDepositSetup(
                new anchor.BN(100),
                new anchor.BN(100)
            ).accountsPartial({
                authority: SWAP_AUTHORITY.publicKey,
                permission: superAdminPermissionKey,
                lpVault,
                vault: vaultAta,
                collateral: tokenMintB,
                strategy,
                strategyRequest,
                collateralVault,
                tokenProgram: TOKEN_PROGRAM_ID,
            }).instruction();

            const burnIx = createBurnInstruction(vaultAta, tokenMintA, SWAP_AUTHORITY.publicKey, 100);
            const mintIx = createMintToInstruction(tokenMintB, collateralVault, program.provider.publicKey, 100);

            try {
                const tx = await program.methods.strategyDepositCleanup().accountsPartial({
                    authority: program.provider.publicKey,
                    //@ts-ignore
                    permission: superAdminPermissionKey,
                    lpVault: lpVault,
                    vault: vaultAta,
                    collateral: tokenMintB,
                    strategy,
                    strategyRequest,
                    collateralVault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                    .preInstructions([setupIx, burnIx, mintIx])
                    .signers([SWAP_AUTHORITY])
                    .rpc();
            } catch (err) {
                console.log(err);
            }
        })
    });
});
