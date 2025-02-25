import {getMultipleMintAccounts, getMultipleTokenAccounts} from "../utils";
import {getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {assert} from "chai";
import * as anchor from "@coral-xyz/anchor";
import {VaultContext} from "./vaultContext";

export const getVaultAccountStates = async (ctx: VaultContext) => {
    const [lpVault, [ownerToken, vault], [ownerShares], [sharesMint]] = await Promise.all([
        ctx.program.account.lpVault.fetch(ctx.lpVault),
        getMultipleTokenAccounts(ctx.program.provider.connection, [
            getAssociatedTokenAddressSync(ctx.currency, ctx.program.provider.publicKey, false, TOKEN_PROGRAM_ID),
            getAssociatedTokenAddressSync(ctx.currency, ctx.lpVault, true, TOKEN_PROGRAM_ID),
        ], TOKEN_PROGRAM_ID),
        getMultipleTokenAccounts(ctx.program.provider.connection, [
            await ctx.getUserSharesAta(),
        ], TOKEN_2022_PROGRAM_ID),
        getMultipleMintAccounts(ctx.program.provider.connection, [
            await ctx.getSharesMint(),
        ], TOKEN_2022_PROGRAM_ID),
    ]);

    return {
        ownerToken,
        ownerShares,
        lpVault,
        vault,
        sharesMint,
    };
};

export const validateDepositVaultStates = async (
    beforePromise: ReturnType<typeof getVaultAccountStates>,
    afterPromise: ReturnType<typeof getVaultAccountStates>,
    amount: bigint,
) => {
    const [before, after] = await Promise.all([beforePromise, afterPromise]);

    const ownerADiff = after.ownerToken.amount - before.ownerToken.amount;
    assert.equal(-ownerADiff, amount);
    const vaultADiff = after.vault.amount - before.vault.amount;
    assert.equal(vaultADiff, BigInt(amount.toString()));

    // Validate the LpVault total assets was incremented properly
    const lpVaultAssetCountDiff = after.lpVault.totalAssets.sub(
        before.lpVault.totalAssets
    );
    assert.equal(lpVaultAssetCountDiff.toString(), amount.toString());

    // Validate shares were minted to the user's account
    const ownerSharesDiff = after.ownerShares.amount - before.ownerShares.amount;
    assert.equal(ownerSharesDiff, BigInt(amount.toString()));
    const sharesSupplyDiff = after.sharesMint.supply - before.sharesMint.supply;
    assert.equal(sharesSupplyDiff, BigInt(amount.toString()));
}

export const validateDeposit = async (ctx: VaultContext, amount: bigint) => {
    try {
        const statesBefore = getVaultAccountStates(ctx);

        await ctx.deposit(amount);

        const statesAfter = getVaultAccountStates(ctx);

        await validateDepositVaultStates(statesBefore, statesAfter, amount);
    } catch (err) {
        if (/insufficient funds/.test(err.message)) {
            assert.ok(true)
        } else {
            console.error(err);
            assert.ok(false);
        }
    }
};

export const validateWithdrawVaultStates = async (
    beforePromise: ReturnType<typeof getVaultAccountStates>,
    afterPromise: ReturnType<typeof getVaultAccountStates>,
    amount: bigint,
) => {
    const [before, after] = await Promise.all([beforePromise, afterPromise]);
    const amountBN = new anchor.BN(amount.toString());

    const roundingProtection = amountBN.div(new anchor.BN(1000)).lt(new anchor.BN(1))
        ? new anchor.BN(1)
        : amountBN.div(new anchor.BN(1000));

    const expectedSharesBurned = amountBN
        .mul(new anchor.BN(before.sharesMint.supply.toString()))
        .add(roundingProtection)
        .div(before.lpVault.totalAssets);

    const ownerADiff = after.ownerToken.amount - before.ownerToken.amount;
    assert.equal(ownerADiff, amount);
    const vaultADiff = after.vault.amount - before.vault.amount;
    assert.equal(-vaultADiff, amount);

    // Validate shares were burned from the user's account
    const ownerSharesDiff = after.ownerShares.amount - before.ownerShares.amount;
    assert.equal(
        ownerSharesDiff,
        BigInt(expectedSharesBurned.neg().toString())
    );
    const sharesSupplyDiff = after.sharesMint.supply - before.sharesMint.supply;
    assert.equal(
        sharesSupplyDiff,
        BigInt(expectedSharesBurned.neg().toString())
    );

    // Validate the LpVault total assets was decremented properly
    const lpVaultAssetCountDiff = after.lpVault.totalAssets.sub(
        before.lpVault.totalAssets
    );
    assert.equal(
        BigInt(lpVaultAssetCountDiff.toString()),
        -amount
    );
}

export const validateWithdraw = async (ctx: VaultContext, amount: bigint) => {
    try {
        const statesBefore = getVaultAccountStates(ctx);
        await ctx.withdraw(amount);
        const statesAfter = getVaultAccountStates(ctx);
        validateWithdrawVaultStates(statesBefore, statesAfter, amount);
    } catch (err) {
        console.error(err);
        assert.ok(false);
    }
};

export const validateDonateVaultStates = async (
    beforePromise: ReturnType<typeof getVaultAccountStates>,
    afterPromise: ReturnType<typeof getVaultAccountStates>,
    amount: bigint
) => {
    const [before, after] = await Promise.all([beforePromise, afterPromise]);

    // Validate no shares were minted
    assert.equal(after.sharesMint.supply, before.sharesMint.supply);

    // Validate tokens were transfered from the user's account to the vault
    const ownerADiff = after.ownerToken.amount - before.ownerToken.amount;
    assert.equal(-ownerADiff, amount);
    const vaultADiff = after.vault.amount - before.vault.amount;
    assert.equal(vaultADiff, amount);

    // Validate the LpVault total assets was incremented properly
    const lpVaultAssetCountDiff = after.lpVault.totalAssets.sub(
        before.lpVault.totalAssets
    );
    assert.equal(lpVaultAssetCountDiff.toString(), amount.toString());
};

export const validateDonate = async (ctx: VaultContext, amount: bigint) => {
    try {
        const statesBefore = getVaultAccountStates(ctx);
        await ctx.donate(amount);
        const statesAfter = getVaultAccountStates(ctx);
        validateDonateVaultStates(statesBefore, statesAfter, amount);
    } catch (err) {
        console.error(err);
        assert.ok(false);
    }
};
