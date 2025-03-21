import * as anchor from "@coral-xyz/anchor";
import {Program} from "@coral-xyz/anchor";
import {WasabiSolana} from "../../target/types/wasabi_solana";
import {assert} from "chai";
import {
    superAdminProgram,
    DEFAULT_AUTHORITY,
    feeWalletKeypair,
    liquidationWalletKeypair
} from "../hooks/rootHook";

describe("wasabi-solana", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.WasabiSolana as Program<WasabiSolana>;

    after(async () => {
        await superAdminProgram.methods
            .initOrUpdatePermission({
                canCosignSwaps:      true,
                canInitVaults:       true,
                canLiquidate:        true,
                canBorrowFromVaults: true,
                canInitPools:        true,
                status:              {active: {}},
            })
            .accounts({
                payer:        superAdminProgram.provider.publicKey,
                newAuthority: DEFAULT_AUTHORITY.publicKey,
            })
            .rpc();
    });

    it("Is initialized!", async () => {
        const [globalSettingsKey] = anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("global_settings")],
            program.programId,
        );
        const [superAdminKey] = anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("super_admin")],
            program.programId,
        );
        const tx = await program.methods
            .initGlobalSettings({
                superAdmin:        superAdminProgram.provider.publicKey,
                feeWallet:         feeWalletKeypair.publicKey,
                liquidationWallet: liquidationWalletKeypair.publicKey,
                statuses:          3,
            })
            .accounts({
                payer: program.provider.publicKey,
            })
            .rpc();
        const globalSettingsAfter = await program.account.globalSettings.fetch(
            globalSettingsKey,
        );
        assert.equal(globalSettingsAfter.statuses, 3);

        const superAdminPermissionAfter = await program.account.permission.fetch(
            superAdminKey,
        );
        assert.ok(superAdminPermissionAfter.isSuperAuthority);
        assert.equal(
            superAdminPermissionAfter.authority.toString(),
            superAdminProgram.provider.publicKey.toString(),
        );
        assert.equal(
            JSON.stringify(superAdminPermissionAfter.status),
            JSON.stringify({active: {}}),
        );
        assert.equal(superAdminPermissionAfter.permissionsMap, 2 ** 8 - 1);
    });
});
