import * as anchor from '@coral-xyz/anchor';
import {assert} from 'chai';
import {AccountLayout} from '@solana/spl-token';
import {
    setupTestEnvironment,
    superAdminProgram,
} from '../hooks/rootHook';
import {initWasabi} from '../hooks/initWasabi';
import {StrategyContext} from './strategyContext';
import {AnchorError, ProgramError} from "@coral-xyz/anchor";

export const getAccountStates = async (ctx: StrategyContext) => {
    const [
        lpVaultState,
        strategyState,
        vaultState,
        collateralVaultState
    ] = await Promise.all([
        superAdminProgram.account.lpVault.fetch(ctx.lpVault),
        superAdminProgram.account.strategy.fetch(ctx.strategy),
        superAdminProgram.provider.connection.getAccountInfo(ctx.vault),
        superAdminProgram.provider.connection.getAccountInfo(ctx.collateralVault),
    ]);

    return {
        lpVault:         lpVaultState,
        strategy:        strategyState,
        vault:           vaultState,
        collateralVault: collateralVaultState,
    };
}


export const validateWithdraw = async (
    ctx: StrategyContext,
    {
        amountIn,
        amountOut
    }: { amountIn: number, amountOut: number }
) => {
    try {
        const statesBefore = getAccountStates(ctx);

        await ctx.strategyWithdraw({amountIn, amountOut});

        await validateStates(
            ctx,
            statesBefore,
            getAccountStates(ctx),
            amountIn.toString(),
            amountOut.toString(),
        );
    } catch (err) {
        console.log(err)
        if (err instanceof AnchorError) {
            assert.equal(err.error.errorCode.number, 6016);
        } else if (err instanceof ProgramError) {
            assert.equal(err.code, 6016);
        } else {
            throw err;
        }
    }
}

export const validateStates = async (
    ctx: StrategyContext,
    beforePromise: ReturnType<typeof getAccountStates>,
    afterPromise: ReturnType<typeof getAccountStates>,
    amountIn: string,
    amountOut: string,
) => {
    const [before, after] = await Promise.all([beforePromise, afterPromise]);
    const actualAmountIn = Number(amountIn) * anchor.web3.LAMPORTS_PER_SOL;
    const actualAmountOut = Number(amountOut) * anchor.web3.LAMPORTS_PER_SOL;

    const vaultBalanceBefore =
        AccountLayout.decode(before.vault.data).amount;
    const collateralVaultBalanceBefore =
        AccountLayout.decode(before.collateralVault.data).amount;

    const vaultBalanceAfter =
        AccountLayout.decode(after.vault.data).amount;
    const collateralVaultBalanceAfter =
        AccountLayout.decode(after.collateralVault.data).amount;

    //principal
    const vaultDiff = new anchor.BN((vaultBalanceAfter - vaultBalanceBefore).toString());

    // Replicates `let new_quote = if collateral_spent != collateral_before 
    let newQuote: anchor.BN;

    // Everything was withdrawn
    if (collateralVaultBalanceAfter === BigInt(0)) {
        newQuote = new anchor.BN(vaultDiff);
    } else {
        newQuote = before.strategy.totalBorrowedAmount
            .mul(new anchor.BN((collateralVaultBalanceBefore - BigInt(actualAmountIn)).toString()))
            .div(new anchor.BN(collateralVaultBalanceBefore.toString()))
            .add(new anchor.BN(vaultDiff));
    }

    // Replicates `strategy_claim_yield(new_quote)`
    const interestEarned = newQuote.sub(before.strategy.totalBorrowedAmount);

    console.log('New quote: ', newQuote.toString());
    console.log('Interested earned: ', interestEarned);
    console.log('Interested earned (event): ', ctx.strategyClaimEvent.amount);

    // Event Data
    assert.equal(
        interestEarned.toString(),
        ctx.strategyClaimEvent.amount.toString(),
        "Interest earned mismatch"
    );

    assert.equal(
        ctx.strategyWithdrawEvent.amountWithdraw.toString(),
        vaultDiff.toString(),
        "Vault diff does not match emitted event"
    );

    const collateralVaultDiff = new anchor.BN(collateralVaultBalanceBefore.toString())
        .sub(new anchor.BN(collateralVaultBalanceAfter.toString()));

    assert.equal(
        ctx.strategyWithdrawEvent.collateralSold.toString(),
        collateralVaultDiff.toString(),
        "Collateral sold mismatch"
    );

    // State Data
    assert.equal(
        before.lpVault.totalBorrowed.sub(after.lpVault.totalBorrowed).toString(),
        new anchor.BN(actualAmountOut).sub(interestEarned).toString(),
        "LP vault diff mismatch"
    );

    assert.equal(
        before.strategy.totalBorrowedAmount
            .sub(after.strategy.totalBorrowedAmount).toString(),
        new anchor.BN(actualAmountOut).sub(interestEarned).toString(),
        "Strategy diff mismatch"
    );

    // Token Balances
    assert.equal(
        vaultDiff.toString(),
        actualAmountOut.toString(), // already includes the interest
        "Vault diff mismatch"
    );

    assert.equal(
        collateralVaultDiff.toString(),
        actualAmountIn.toString(),
        "Collateral vault diff mismatch"
    );
};

export const validateClaim = async (ctx: StrategyContext, newQuote: number) => {
    try {
        await ctx.program.methods
            .strategyClaimYield(new anchor.BN(newQuote))
            .accountsPartial(ctx.getClaimAccounts())
            .signers([ctx.BORROW_AUTHORITY])
            .rpc();
        const statesAfter = getAccountStates(ctx);
        await validateClaimStates(statesAfter, newQuote);
    } catch (err) {
        if (err instanceof anchor.AnchorError) {
            assert.equal(err.error.errorCode.number, 6016);
        } else {
            assert.ok(false);
        }
    }
}

export const validateDeposit = async (
    ctx: StrategyContext,
    {
        amountIn,
        amountOut
    }: {
        amountIn: number,
        amountOut: number
    }
) => {
    try {
        const statesBefore = getAccountStates(ctx);
        await ctx.strategyDeposit({
            amountIn,
            amountOut,
        });
        return await validateDepositStates(
            statesBefore,
            getAccountStates(ctx),
            amountIn,
            amountOut,
        );
    } catch (err) {
        console.error(err);
        assert.ok(false);
    }
};

export const validateDepositStates = async (
    beforePromise: ReturnType<typeof getAccountStates>,
    afterPromise: ReturnType<typeof getAccountStates>,
    amountIn: number,
    amountOut: number,
) => {
    const [before, after] = await Promise.all([beforePromise, afterPromise]);
    const actualAmountIn = amountIn * anchor.web3.LAMPORTS_PER_SOL;
    const actualAmountOut = amountOut * anchor.web3.LAMPORTS_PER_SOL;

    const vaultBeforeData = AccountLayout.decode(before.vault.data);
    const vaultAfterData = AccountLayout.decode(after.vault.data);

    const collateralVaultBalanceBefore =
        AccountLayout.decode(before.collateralVault.data).amount;
    const collateralVaultBalanceAfter =
        AccountLayout.decode(after.collateralVault.data).amount;

    assert.equal(
        after.lpVault.totalBorrowed.toNumber(),
        (before.lpVault.totalBorrowed.add(new anchor.BN(actualAmountIn)).toNumber())
    );

    assert.equal(
        after.strategy.totalBorrowedAmount.toNumber(),
        (before.strategy.totalBorrowedAmount.add(new anchor.BN(actualAmountOut)).toNumber())
    );

    assert.equal(
        Number(vaultAfterData.amount),
        Number(vaultBeforeData.amount - BigInt(actualAmountIn))
    );

    assert.equal(
        Number(collateralVaultBalanceAfter),
        Number(collateralVaultBalanceBefore + BigInt(actualAmountOut))
    );
};

export const validateClaimStates = async (
    afterPromise: ReturnType<typeof getAccountStates>,
    delta: number,
) => {
    const after = await afterPromise;

    assert.equal(
        after.strategy.totalBorrowedAmount.toNumber(),
        delta
    );

    assert.equal(
        after.lpVault.totalBorrowed.toNumber(),
        delta
    );
}

export const mochaHooks = {
    beforeAll: async () => {
        await setupTestEnvironment();
        await initWasabi();
    },
}
