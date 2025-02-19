import * as anchor from '@coral-xyz/anchor';
import { assert } from 'chai';
import { SystemProgram } from '@solana/web3.js';
import {
    AccountLayout,
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountIdempotentInstruction,
    createBurnInstruction,
    createMintToInstruction
} from '@solana/spl-token';
import {
    WASABI_PROGRAM_ID,
    BORROW_AUTHORITY,
    NON_BORROW_AUTHORITY,
    tokenMintB,
    tokenMintA,
    setupTestEnvironment,
    superAdminProgram,
    lpVaultA
} from './allHook';
import { initWasabi } from './initWasabi';
import { WasabiSolana } from '../../target/types/wasabi_solana';

export const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

export const currency = tokenMintA;
export const collateral = tokenMintB;

export const vault = getAssociatedTokenAddressSync(
    tokenMintA,
    lpVaultA,
    true,
    TOKEN_PROGRAM_ID
);
export const collateralVault = getAssociatedTokenAddressSync(
    tokenMintB,
    lpVaultA,
    true,
    TOKEN_PROGRAM_ID,
);

export const collateralVaultAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    BORROW_AUTHORITY.publicKey,
    collateralVault,
    lpVaultA,
    collateral,
    TOKEN_PROGRAM_ID
);

export const [strategy] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("strategy"), lpVaultA.toBuffer(), collateral.toBuffer()],
    WASABI_PROGRAM_ID,
);
const [strategyRequest] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("strategy_request"), strategy.toBuffer()],
    WASABI_PROGRAM_ID,
);

const [permission] = anchor.web3.PublicKey.findProgramAddressSync(
    [
        anchor.utils.bytes.utf8.encode("admin"),
        BORROW_AUTHORITY.publicKey.toBuffer(),
    ],
    WASABI_PROGRAM_ID,
);

export const accountStates = async () => {
    const [lpVaultState, strategyState, vaultState, collateralVaultState] = await Promise.all([
        superAdminProgram.account.lpVault.fetch(lpVaultA),
        superAdminProgram.account.strategy.fetch(strategy),
        superAdminProgram.provider.connection.getAccountInfo(vault),
        superAdminProgram.provider.connection.getAccountInfo(collateralVault),
    ]);

    return {
        lpVault: lpVaultState,
        strategy: strategyState,
        vault: vaultState,
        collateralVault: collateralVaultState,
    };
};

export const depositSwapInstructions = (x: number, y: number) => {
    const burnIx = createBurnInstruction(vault, currency, BORROW_AUTHORITY.publicKey, x);
    const mintIx = createMintToInstruction(collateral, collateralVault, program.provider.publicKey, y);
    return [burnIx, mintIx];
};

export const withdrawSwapInstructions = (x: number, y: number) => {
    const burnIx = createBurnInstruction(collateralVault, collateral, BORROW_AUTHORITY.publicKey, x);
    const mintIx = createMintToInstruction(currency, vault, program.provider.publicKey, y);
    return [burnIx, mintIx];
};


export const strategyDepositSetup = async (x: number, y: number) => {
    return await program.methods.strategyDepositSetup(
        new anchor.BN(x),
        new anchor.BN(y)
    ).accountsPartial(strategyAccounts()).instruction();
};

export const strategyWithdrawSetup = async (x: number, y: number) => {
    return await program.methods.strategyWithdrawSetup(
        new anchor.BN(x),
        new anchor.BN(y)
    ).accountsPartial(strategyAccounts()).instruction();
};

export const strategyDeposit = async ({
    amountIn,
    amountOut,
}: {
    amountIn: number,
    amountOut: number,
}) => {
    await program.methods.strategyDepositCleanup()
        .accountsPartial(strategyAccounts())
        .preInstructions([
            await strategyDepositSetup(amountIn, amountOut),
            ...depositSwapInstructions(amountIn, amountOut)
        ])
        .signers([BORROW_AUTHORITY])
        .rpc();
};

export const strategyWithdraw = async ({
    amountIn,
    amountOut,
}: {
    amountIn: number,
    amountOut: number,
}) => {
    await program.methods.strategyWithdrawCleanup()
        .accountsPartial(strategyAccounts())
        .preInstructions([
            await strategyWithdrawSetup(amountIn, amountOut),
            ...withdrawSwapInstructions(amountIn, amountOut)
        ])
        .signers([BORROW_AUTHORITY])
        .rpc();
};

export const strategyAccounts = () => {
    return {
        authority: BORROW_AUTHORITY.publicKey,
        permission,
        lpVault: lpVaultA,
        vault,
        collateral,
        strategy,
        strategyRequest,
        collateralVault,
        tokenProgram: TOKEN_PROGRAM_ID,
    }
};

export const validateWithdraw = async ({
    amountIn,
    amountOut
}: { amountIn: number, amountOut: number }) => {
    try {
        const statesBefore = accountStates();

        await strategyWithdraw({ amountIn, amountOut });

        await validateStates(statesBefore, accountStates(), amountIn.toString());
    } catch (err) {
        console.error(err);
        assert.ok(false);
    }
}

export const validateStates = async (
    beforePromise: ReturnType<typeof accountStates>,
    afterPromise: ReturnType<typeof accountStates>,
    predicate: string,
) => {
    const before = await beforePromise;
    const after = await afterPromise;

    const vaultBalanceBefore =
        AccountLayout.decode(before.vault.data).amount;
    const collateralVaultBalanceBefore =
        AccountLayout.decode(before.collateralVault.data).amount;

    const vaultBalanceAfter =
        AccountLayout.decode(after.vault.data).amount;
    const collateralVaultBalanceAfter =
        AccountLayout.decode(after.collateralVault.data).amount;

    const vaultDiff = new anchor.BN(vaultBalanceAfter.toString())
        .sub(new anchor.BN(vaultBalanceBefore.toString()));

    const lpVaultDiff = before.lpVault.totalBorrowed
        .sub(after.lpVault.totalBorrowed);

    const collateralVaultDiff = new anchor.BN(collateralVaultBalanceBefore.toString())
        .sub(new anchor.BN(collateralVaultBalanceAfter.toString()));

    const strategyDiff = before.strategy.totalBorrowedAmount
        .sub(after.strategy.totalBorrowedAmount);

    assert.equal(
        lpVaultDiff.toString(),
        predicate,
        "LP vault diff mismatch"
    );
    assert.equal(
        strategyDiff.toString(),
        predicate,
        "Strategy diff mismatch"
    );
    assert.equal(
        collateralVaultDiff.toString(),
        predicate,
        "Collateral vault diff mismatch"
    );
    assert.equal(
        vaultDiff.toString(),
        predicate,
        "Vault diff mismatch"
    );
};

export const strategyClaim = async (newQuote: number) => {
    program.methods.strategyClaimYield(new anchor.BN(newQuote))
        .accountsPartial(claimAccounts()).signers([BORROW_AUTHORITY]).rpc();
};

export const strategyClaimIx = async (newQuote: number) => {
    return program.methods.strategyClaimYield(new anchor.BN(newQuote))
        .accountsPartial(claimAccounts()).instruction()
};

export const claimAccounts = () => {
    return {
        authority: BORROW_AUTHORITY.publicKey,
        permission,
        lpVault: lpVaultA,
        collateral,
        strategy,
    };
};

export const validateClaim = async (newQuote: number) => {
    const statesBefore = accountStates();
    try {
        await program.methods.strategyClaimYield(new anchor.BN(newQuote))
            .accountsPartial(claimAccounts()).signers([BORROW_AUTHORITY]).rpc();
        const statesAfter = accountStates();
        await validateClaimStates(statesBefore, statesAfter, newQuote);
    } catch (err) {
        if (err instanceof anchor.AnchorError) {
            assert.equal(err.error.errorCode.number, 6016);
        } else {
            assert.ok(false);
        }
    };
}

export const validateClaimStates = async (
    beforePromise: ReturnType<typeof accountStates>,
    afterPromise: ReturnType<typeof accountStates>,
    delta: number,
) => {
    const [before, after] = await Promise.all([beforePromise, afterPromise]);

    assert.equal(
        after.strategy.totalBorrowedAmount.toNumber(),
        delta
    );

    assert.equal(
        after.lpVault.totalBorrowed.toNumber(),
        delta
    );
}

export const strategyWithdrawClaimBefore = async (
    {
        amountIn,
        amountOut,
        newQuote
    }: {
        amountIn: number,
        amountOut: number,
        newQuote: number
    }
) => {
    await program.methods.strategyWithdrawCleanup()
        .accountsPartial(strategyAccounts())
        .preInstructions([
            await strategyWithdrawSetup(amountIn, amountOut),
            await strategyClaimIx(newQuote),
            ...withdrawSwapInstructions(amountIn, amountOut)
        ])
        .signers([BORROW_AUTHORITY])
        .rpc();
};

export const strategyWithdrawClaimAfter = async (
    {
        amountIn,
        amountOut,
        newQuote
    }: {
        amountIn: number,
        amountOut: number,
        newQuote: number
    }
) => {
    await program.methods.strategyWithdrawCleanup()
        .accountsPartial(strategyAccounts())
        .preInstructions([
            await strategyWithdrawSetup(amountIn, amountOut),
            ...withdrawSwapInstructions(amountIn, amountOut),
            await strategyClaimIx(newQuote),
        ])
        .signers([BORROW_AUTHORITY])
        .rpc();
};

export const closeStrategy = async () => {
    await program.methods.closeStrategy().accountsPartial(
        closeAccounts()
    ).rpc();
}

export const closeAccounts = () => {
    return {
        authority: BORROW_AUTHORITY.publicKey,
        permission,
        lpVault: lpVaultA,
        collateral,
        strategy,
        collateralVault,
        tokenProgram: TOKEN_PROGRAM_ID,
    }
}

export const setupStrategy = async () => {
    const borrowPermissionIx = await superAdminProgram.methods.initOrUpdatePermission({
        canCosignSwaps: true,
        canInitVaults: true,
        canLiquidate: true,
        canInitPools: true,
        canBorrowFromVaults: true,
        status: { active: {} }
    }).accounts({
        payer: superAdminProgram.provider.publicKey,
        newAuthority: BORROW_AUTHORITY.publicKey,
    }).instruction();

    const nonBorrowPermissionIx = await superAdminProgram.methods.initOrUpdatePermission({
        canCosignSwaps: true,
        canInitVaults: true,
        canLiquidate: true,
        canInitPools: true,
        canBorrowFromVaults: true,
        status: { active: {} }
    }).accounts({
        payer: superAdminProgram.provider.publicKey,
        newAuthority: NON_BORROW_AUTHORITY.publicKey,
    }).instruction();

    await superAdminProgram.methods.initStrategy().accountsPartial({
        //@ts-ignore
        authority: BORROW_AUTHORITY.publicKey,
        permission,
        lpVault: lpVaultA,
        vault,
        currency,
        collateral,
        strategy: strategy,
        collateralVault,
        systemProgram: SystemProgram.programId,

    })
        .preInstructions([borrowPermissionIx, nonBorrowPermissionIx, collateralVaultAtaIx])
        .signers([BORROW_AUTHORITY])
        .rpc();
};

export const mochaHooks = {
    beforeAll: async () => {
        await setupTestEnvironment();
        await initWasabi();
    },
}
