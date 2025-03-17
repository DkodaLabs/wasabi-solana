import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import { superAdminProgram } from "./hooks/rootHook";

describe("setDebtControllerMaxLeverage", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
    const [debtControllerKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("debt_controller")],
        program.programId,
    );

    it("should fail if not super admin", async () => {
        try {
            await program.methods.setMaxLeverage(
                new anchor.BN(50),
            ).accounts({
                authority: program.provider.publicKey,
            }).rpc();
            assert.fail("Expected error");
        } catch (err) {
            if (err.message.includes("Expected error")) {
                assert.fail("Expected error");
            }
            assert.ok(true);
        }
    });

    it("should fail with invalid max leverage", async () => {
        try {
            await superAdminProgram.methods.setMaxLeverage(
                new anchor.BN(0),
            ).accounts({
                authority: superAdminProgram.provider.publicKey,
            }).rpc();
            assert.fail("Expected error");
        } catch (err) {
            if (err instanceof anchor.AnchorError) {
                assert.equal(err.error.errorCode.number, 6013);
            } else if (err instanceof anchor.ProgramError) {
                assert.equal(err.code, 6013);
            } else {
                assert.ok(false);
            }
        }

        try {
            await superAdminProgram.methods.setMaxLeverage(
                new anchor.BN(101 * 100),
            ).accounts({
                authority: superAdminProgram.provider.publicKey,
            }).rpc();
            assert.fail("Expected error");
        } catch (err) {
            if (err instanceof anchor.AnchorError) {
                assert.equal(err.error.errorCode.number, 6013);
            } else if (err instanceof anchor.ProgramError) {
                assert.equal(err.code, 6013);
            } else {
                assert.ok(false);
            }
        }
    });

    it("should set max leverage", async () => {
        const debtControllerBefore = await program.account.debtController.fetch(debtControllerKey);
        await superAdminProgram.methods.setMaxLeverage(
            new anchor.BN(200),
        ).accounts({
            authority: superAdminProgram.provider.publicKey,
        }).rpc();
        const debtControllerAfter = await program.account.debtController.fetch(debtControllerKey);
        assert.equal(debtControllerAfter.maxLeverage.toNumber(), 200);
        assert.notEqual(debtControllerBefore.maxLeverage.toNumber(), debtControllerAfter.maxLeverage.toNumber());
    });
});
