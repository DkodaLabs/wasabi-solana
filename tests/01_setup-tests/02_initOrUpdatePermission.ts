import * as anchor from "@coral-xyz/anchor";
import {assert} from "chai";
import {superAdminProgram, DEFAULT_AUTHORITY} from "../hooks/rootHook";

describe("InitOrUpdatePermission", () => {
    it("Is initialized!", async () => {
        const newAuthority = DEFAULT_AUTHORITY.publicKey;
        const [adminKey] = anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("admin"), newAuthority.toBuffer()],
            superAdminProgram.programId,
        );

        await superAdminProgram.methods
            .initOrUpdatePermission({
                canCosignSwaps:      true, // 4
                canInitVaults:       true, // 1
                canLiquidate:        true, // 2
                canInitPools:        true, // 8
                canBorrowFromVaults: true,
                status:              {active: {}}
            })
            .accounts({
                payer: superAdminProgram.provider.publicKey,
                newAuthority,
            })
            .rpc();

        const permissionAfter = await superAdminProgram.account.permission.fetch(adminKey);
        assert.ok(!permissionAfter.isSuperAuthority);
        assert.equal(permissionAfter.authority.toString(), newAuthority.toString());
        assert.equal(JSON.stringify(permissionAfter.status), JSON.stringify({active: {}}));
        assert.equal(permissionAfter.permissionsMap, 31);
    });
});
