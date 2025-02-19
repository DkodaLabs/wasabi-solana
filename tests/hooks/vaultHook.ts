import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SWAP_AUTHORITY, setupTestEnvironment, superAdminProgram, lpVaultA, lpVaultB, tokenMintA, tokenMintB, vaultA as _vaultA } from "./allHook";
import { initWasabi } from "./initWasabi";
import { WasabiSolana } from "../../target/types/wasabi_solana";
import { getMultipleTokenAccounts, getMultipleMintAccounts } from '../utils';

const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

export const deposit = async (amount: bigint) => {
    return await program.methods
        .deposit(new anchor.BN(amount.toString()))
        .accountsPartial(vaultAccounts())
        .rpc();
};

export const withdraw = async (amount: bigint) => {
    return await program.methods
        .withdraw(new anchor.BN(amount.toString()))
        .accountsPartial(vaultAccounts())
        .rpc();
};

export const donate = async (amount: bigint) => {
    return await program.methods
        .donate(new anchor.BN(amount.toString()))
        .accountsPartial({
            owner: program.provider.publicKey,
            permission: anchor.web3.PublicKey.findProgramAddressSync(
                [Buffer.from("admin"), program.provider.publicKey.toBuffer()],
                program.programId
            )[0],
            currency: tokenMintA,
            tokenProgram: TOKEN_PROGRAM_ID,
            ...vaultAccounts()
        })
        .rpc();
};

export const vaultAccounts = () => {
    return {
        owner: program.provider.publicKey,
        lpVault: lpVaultA,
        assetMint: tokenMintA,
        assetTokenProgram: TOKEN_PROGRAM_ID,
    }
};

export const tokenAAta = getAssociatedTokenAddressSync(
    tokenMintA,
    program.provider.publicKey,
    false,
    TOKEN_PROGRAM_ID,
);

export const tokenBAta = getAssociatedTokenAddressSync(
    tokenMintB,
    program.provider.publicKey,
    false,
    TOKEN_PROGRAM_ID,
);

export const sharesMintA = async () => {
    return await program.account.lpVault.fetch(lpVaultA).then(v => v.sharesMint);
}

export const sharesMintB = async () => {
    return await program.account.lpVault.fetch(lpVaultB).then(v => v.sharesMint);
}

export const ownerSharesAccountA = async () => {
    return getAssociatedTokenAddressSync(
        await sharesMintA(),
        program.provider.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
    );
}

export const ownerSharesAccountB = async () => {
    getAssociatedTokenAddressSync(
        await sharesMintB(),
        program.provider.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
    );
}

export const vaultAccountStates = async () => {
    const [lpVault, [ownerToken, vault], [ownerShares], [sharesMint]] = await Promise.all([
        program.account.lpVault.fetch(lpVaultA),
        getMultipleTokenAccounts(program.provider.connection, [
            tokenAAta,
            _vaultA,
        ], TOKEN_PROGRAM_ID),
        getMultipleTokenAccounts(program.provider.connection, [
            await ownerSharesAccountA(),
        ], TOKEN_2022_PROGRAM_ID),
        getMultipleMintAccounts(program.provider.connection, [
            await sharesMintA(),
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
    beforePromise: ReturnType<typeof vaultAccountStates>,
    afterPromise: ReturnType<typeof vaultAccountStates>,
    amount: bigint,
) => {
    const [before, after] = await Promise.all([beforePromise, afterPromise]);

    const ownerADiff = after.ownerToken.amount - before.ownerToken.amount;
    assert.equal(-ownerADiff, BigInt(amount.toString()));
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

export const validateDeposit = async (amount: bigint) => {
    const statesBefore = vaultAccountStates();

    await deposit(amount);

    const statesAfter = vaultAccountStates();

    validateDepositVaultStates(statesBefore, statesAfter, amount);
};

export const validateWithdrawVaultStates = async (
    beforePromise: ReturnType<typeof vaultAccountStates>,
    afterPromise: ReturnType<typeof vaultAccountStates>,
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

export const validateWithdraw = async (amount: bigint) => {
    const statesBefore = vaultAccountStates();
    await withdraw(amount);
    const statesAfter = vaultAccountStates();
    validateWithdrawVaultStates(statesBefore, statesAfter, amount);
};

export const validateDonateVaultStates = async (
    beforePromise: ReturnType<typeof vaultAccountStates>,
    afterPromise: ReturnType<typeof vaultAccountStates>,
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


export const validateDonate = async (amount: bigint) => {
    const statesBefore = vaultAccountStates();
    await donate(amount);
    const statesAfter = vaultAccountStates();
    validateDonateVaultStates(statesBefore, statesAfter, amount);
};

export const mochaHooks = {
    beforeAll: async () => {
        await setupTestEnvironment();
        await initWasabi();
    }
};
