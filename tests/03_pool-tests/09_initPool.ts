import { validateInitPool } from "./hooks/initWasabi";

describe("InitLongPool", () => {
    it("should create the longPool", async () => {
        await validateInitPool(true);
    });
});

describe("InitShortPool", () => {
    it("should create the shortPool", async () => {
        await validateInitPool(false);
    });
});

//describe("non permissioned signer", () => { it("should fail", async () => {
//        const NO_AUTH = anchor.web3.Keypair.generate();
//        //@ts-ignore
//        const _noPermissionTxn = await superAdminProgram.methods.initOrUpdatePermission({
//            canCosignSwaps: true,
//            canInitVaults: false,
//            canInitPool: false,
//            canLiquidate: false,
//            canBorrowFromVaults: false,
//            status: { active: {} },
//        }).accounts({
//            payer: superAdminProgram.provider.publicKey,
//            newAuthority: NO_AUTH.publicKey,
//        }).rpc();
//
//        const [noPerm] = anchor.web3.PublicKey.findProgramAddressSync(
//            [
//                anchor.utils.bytes.utf8.encode("admin"),
//                NO_AUTH.publicKey.toBuffer(),
//            ],
//            program.programId,
//        );
//
//        try {
//            await program.methods
//                .initLongPool()
//                .accountsPartial({
//                    payer: program.provider.publicKey,
//                    authority: NO_AUTH.publicKey,
//                    permission: noPerm,
//                    collateral: tokenMintB,
//                    currency: tokenMintA,
//                    collateralTokenProgram: TOKEN_PROGRAM_ID,
//                    currencyTokenProgram: TOKEN_PROGRAM_ID,
//                })
//                .signers([NO_AUTH])
//                .rpc();
//            assert.ok(false);
//        } catch (e: any) {
//            if (e instanceof anchor.AnchorError) {
//                assert.equal(e.error.errorCode.number, 6000);
//            } else {
//                assert.ok(false);
//            }
//        }
//    });
//});
