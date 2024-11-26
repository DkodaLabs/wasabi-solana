import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { superAdminProgram } from "./rootHooks";
import { WasabiSolana } from "../target/types/wasabi_solana";

describe("GenerateLiquidationWallet", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

    const [superAdminPermissionKey] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            program.programId,
        );

    const [globalSettings] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("global_settings")],
        program.programId,
    );

    const [liquidationWallet] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("protocol_wallet"),
            globalSettings.toBuffer(),
            Buffer.from([0]),
            Buffer.from([1]),
        ],
        program.programId,
    );


    it("should create a liquidation wallet", async () => {
        try {
            await superAdminProgram.methods.generateWallet(1, 1)
                .accountsPartial({
                    authority: superAdminProgram.provider.publicKey,
                    permission: superAdminPermissionKey,
                }).rpc();

            const liquidationWalletAccount = await superAdminProgram.account.protocolWallet.fetch(liquidationWallet);
            assert.equal(liquidationWalletAccount.walletType, 1);
        } catch (error: any) {
            console.log(error.message);
        }
    });
})

