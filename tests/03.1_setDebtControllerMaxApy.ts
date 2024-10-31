import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { superAdminProgram } from "./rootHooks";

describe("setDebtControllerMaxApy", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
    const [debtControllerKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("debt_controller")],
        program.programId,
    );

    it("should fail without super admin", async () => {
        try {
            await program.methods.setMaxApy(
                new anchor.BN(50),
            ).accounts({
                authority: program.provider.publicKey,
            }).rpc();
            assert.fail("Expected error");
        } catch (err) {
            if (err.message.includes("Expected error")) {
                assert.fail("Expected error");
                return;
            }
            assert.ok(true);
        }
    });

    it("should fail with invalid max apy", async () => {
        try {
            await superAdminProgram.methods.setMaxApy(
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
            await superAdminProgram.methods.setMaxApy(
                new anchor.BN(1001 * 100),
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

    it("should set max apy", async () => {
        const debtControllerBefore = await program.account.debtController.fetch(debtControllerKey);
        await superAdminProgram.methods.setMaxApy(
            new anchor.BN(300),
        ).accounts({
            authority: superAdminProgram.provider.publicKey,
        }).rpc();
        const debtControllerAfter = await program.account.debtController.fetch(debtControllerKey);
        assert.equal(debtControllerAfter.maxApy.toNumber(), 300);
        assert.notEqual(debtControllerBefore.maxApy.toString(), debtControllerAfter.maxApy.toString());
    });

});
