import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { tokenMintA } from "./rootHooks";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getMultipleMintAccounts, getMultipleTokenAccounts } from "./utils";

describe("Mint", () => {
    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
    const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
        program.programId
    );
    let lpVault: anchor.IdlAccounts<WasabiSolana>["lpVault"];
    let ownerSharesAccount: anchor.web3.PublicKey;

    before(async () => {
        lpVault = await program.account.lpVault.fetch(lpVaultKey);
        // User's shares mint accounts were already created in `04_deposit.ts`
        ownerSharesAccount = getAssociatedTokenAddressSync(
            lpVault.sharesMint,
            program.provider.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
    });

    it("Should mint a specified number of shares", async () => {
        const sharesAmount = new anchor.BN(1_000_000);
        const tokenAAta = getAssociatedTokenAddressSync(
            tokenMintA,
            program.provider.publicKey,
            false
        );
        const [
            [ownerTokenABefore, vaultABefore],
            [ownerSharesBefore],
            [sharesMintBefore],
        ] = await Promise.all([
            getMultipleTokenAccounts(program.provider.connection, [
                tokenAAta,
                lpVault.vault,
            ], TOKEN_PROGRAM_ID),
            getMultipleTokenAccounts(program.provider.connection, [
                ownerSharesAccount
            ], TOKEN_2022_PROGRAM_ID),
            getMultipleMintAccounts(program.provider.connection, [
                lpVault.sharesMint,
            ], TOKEN_2022_PROGRAM_ID),
        ]);

        // calculate amount of tokens expected to be deposited based on
        // current state.
        const shareSupplyBefore = new anchor.BN(sharesMintBefore.supply.toString());
        const expectedTokensIn =
            sharesMintBefore.supply > BigInt(0)
                ? lpVault.totalAssets
                    .mul(sharesAmount)
                    .add(shareSupplyBefore)
                    .div(shareSupplyBefore)
                : sharesAmount;

        await program.methods
            .mint({ sharesAmount })
            .accounts({
                owner: program.provider.publicKey,
                lpVault: lpVaultKey,
                assetMint: tokenMintA,
                assetTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        const [
            [ownerTokenAAfter, vaultAAfter],
            [ownerSharesAfter],
            lpVaultAfter,
            [sharesMintAfter],
        ] = await Promise.all([
            getMultipleTokenAccounts(program.provider.connection, [
                tokenAAta,
                lpVault.vault,
            ], TOKEN_PROGRAM_ID),
            getMultipleTokenAccounts(program.provider.connection, [
                ownerSharesAccount
            ], TOKEN_2022_PROGRAM_ID),
            program.account.lpVault.fetch(lpVaultKey),
            getMultipleMintAccounts(program.provider.connection, [
                lpVault.sharesMint,
            ], TOKEN_2022_PROGRAM_ID),
        ]);
        // Validate shares were minted to the user's account
        const ownerSharesDiff = ownerSharesAfter.amount - ownerSharesBefore.amount;
        assert.equal(ownerSharesDiff, BigInt(sharesAmount.toString()));
        const sharesSupplyDiff = sharesMintAfter.supply - sharesMintBefore.supply;
        assert.equal(sharesSupplyDiff, BigInt(sharesAmount.toString()));

        // Validate tokens were transfered from the user's account to the vault
        const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
        assert.equal(-ownerADiff, BigInt(expectedTokensIn.toString()));
        const vaultADiff = vaultAAfter.amount - vaultABefore.amount;
        assert.equal(vaultADiff, BigInt(expectedTokensIn.toString()));

        // Validate the LpVault total assets was incremented properly
        const lpVaultAssetCountDiff = lpVaultAfter.totalAssets.sub(
            lpVault.totalAssets
        );
        assert.equal(lpVaultAssetCountDiff.toString(), expectedTokensIn.toString());
    });
});
