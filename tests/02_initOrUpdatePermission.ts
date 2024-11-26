import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { NON_SWAP_AUTHORITY, superAdminProgram } from "./rootHooks";

describe("InitOrUpdatePermission", () => {
    it("Is initialized!", async () => {
        const newAuthority = NON_SWAP_AUTHORITY.publicKey;
        const [adminKey] = anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("admin"), newAuthority.toBuffer()],
            superAdminProgram.programId,
        );
        const tx = await superAdminProgram.methods
            .initOrUpdatePermission({
                canCosignSwaps: false, // 4
                canInitVaults: true, // 1
                canLiquidate: true, // 2
                canBorrowFromVaults: true, // 8
                canInitPools: true, // 16
                canManageWallets: true, // 32
                status: { active: {} }
            })
            .accounts({
                payer: superAdminProgram.provider.publicKey,
                newAuthority,
            })
            .rpc();

        const permissionAfter = await superAdminProgram.account.permission.fetch(adminKey);
        assert.ok(!permissionAfter.isSuperAuthority);
        assert.equal(permissionAfter.authority.toString(), newAuthority.toString());
        assert.equal(JSON.stringify(permissionAfter.status), JSON.stringify({ active: {} }));
        assert.equal(permissionAfter.permissionsMap, 59);
    });
});
