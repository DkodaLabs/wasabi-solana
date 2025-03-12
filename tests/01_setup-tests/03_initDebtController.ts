import * as anchor from "@coral-xyz/anchor";
import {WasabiSolana} from "../../target/types/wasabi_solana";
import {superAdminProgram} from "../hooks/rootHook"
import {assert} from "chai";

describe("initDebtController", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
    const [debtController] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("debt_controller")],
        program.programId,
    );

    it("should fail without super admin", async () => {
        try {
            let args = {
                maxApy:         new anchor.BN(100),
                maxLeverage:    new anchor.BN(100),
                liquidationFee: 1,
            }
            await program.methods.initDebtController(
                args.maxApy,
                args.maxLeverage,
                args.liquidationFee,
            ).accounts({
                superAdmin: program.provider.publicKey,
            }).rpc();
            assert.fail("Expected error");
        } catch (err) {
            if (err.message.includes("Expected error")) {
                assert.fail("Expected error");
            }
            assert.ok(true);
        }
    });

    it("should init debt controller", async () => {
        await superAdminProgram.methods.initDebtController(
            new anchor.BN(100),
            new anchor.BN(100),
            1,
        ).accounts({
            superAdmin: superAdminProgram.provider.publicKey,
        }).rpc();
        const debtControllerAccount = await program.account.debtController.fetch(debtController);
        assert.equal(debtControllerAccount.maxApy.toNumber(), 100);
        assert.equal(debtControllerAccount.maxLeverage.toNumber(), 100);
        assert.equal(debtControllerAccount.liquidationFee, 1);
    });
});
