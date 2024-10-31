import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { NON_SWAP_AUTHORITY, SWAP_AUTHORITY, tokenMintA } from "./rootHooks";
import { assert } from "chai";

describe("UpdateVaultMaxBorrow", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
    const [validPermission] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("admin"),
            NON_SWAP_AUTHORITY.publicKey.toBuffer(),
        ],
        program.programId
    );
    const [invalidPermission] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("admin"),
            SWAP_AUTHORITY.publicKey.toBuffer(),
        ],
        program.programId
    );
    const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
        program.programId
    );

    it("Should fail if authority does not have init vault permissions", async () => {
        try {
            await program.methods
                .updateLpVaultMaxBorrow(new anchor.BN(100))
                .accounts({
                    //@ts-ignore
                    authority: SWAP_AUTHORITY.publicKey,
                    permission: invalidPermission,
                    lpVault: lpVaultKey,
                })
                .signers([SWAP_AUTHORITY])
                .rpc();
            throw new Error("should fail");
        } catch (err) {
            if (err instanceof anchor.AnchorError) {
                assert.equal(err.error.errorCode.number, 6000);
            } else {
                assert.ok(false);
            }
        }
    });

    it("Should update lp vault max borrow", async () => {
        const maxBorrow = new anchor.BN(100);
        await program.methods
            .updateLpVaultMaxBorrow(maxBorrow)
            .accounts({
                //@ts-ignore
                authority: NON_SWAP_AUTHORITY.publicKey,
                permission: validPermission,
                lpVault: lpVaultKey,
            })
            .signers([NON_SWAP_AUTHORITY])
            .rpc();
        const lpVault = await program.account.lpVault.fetch(lpVaultKey);
        assert.ok(lpVault.maxBorrow.eq(maxBorrow));
    });
});
