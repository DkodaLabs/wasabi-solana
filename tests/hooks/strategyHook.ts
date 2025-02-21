import * as anchor from '@coral-xyz/anchor';
import { assert } from 'chai';
import { Keypair, SystemProgram, PublicKey, Transaction } from '@solana/web3.js';
import {
    AccountLayout,
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountIdempotentInstruction,
    createBurnInstruction,
    createMintToInstruction,
    createMintToCheckedInstruction,
} from '@solana/spl-token';
import {
    WASABI_PROGRAM_ID,
    setupTestEnvironment,
    superAdminProgram,
    NON_SWAP_AUTHORITY
} from './allHook';
import { initWasabi } from './initWasabi';
import { TestContext } from './tester';

export class StrategyContext extends TestContext {
    collateralVault: PublicKey;
    strategy: PublicKey;
    strategyRequest: PublicKey;

    skip = true;

    constructor(
        readonly BORROW_AUTHORITY = Keypair.generate(),
        readonly NON_BORROW_AUTHORITY = Keypair.generate(),
        readonly borrowPermission = PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("admin"),
                BORROW_AUTHORITY.publicKey.toBuffer(),
            ],
            WASABI_PROGRAM_ID,
        )[0],
        readonly invalidPermission = PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("admin"),
                NON_BORROW_AUTHORITY.publicKey.toBuffer(),
            ],
            WASABI_PROGRAM_ID,
        )[0],
    ) {
        super();
    }

    skipSetup(skip: boolean): this {
        this.skip = skip;
        return this;
    }

    async generateWithInitialDeposit({ amountIn, amountOut }: {
        amountIn: number,
        amountOut: number
    }) {
        await this.generate();
        await strategyDeposit(this, { amountIn, amountOut });

        return this;
    }

    async generateWithdrawTestDefault() {
        await this.generate();
        await strategyDeposit(this, { amountIn: 1_000, amountOut: 1_000 });

        return this;
    }

    async generate() {
        await super._generate();

        this.strategy = PublicKey.findProgramAddressSync(
            [
                Buffer.from("strategy"),
                this.lpVault.toBuffer(),
                this.collateral.toBuffer(),
            ],
            WASABI_PROGRAM_ID
        )[0];

        this.strategyRequest = PublicKey.findProgramAddressSync(
            [
                Buffer.from("strategy_request"),
                this.strategy.toBuffer(),
            ],
            WASABI_PROGRAM_ID
        )[0];

        const mintCurrencyToLpVault = createMintToCheckedInstruction(
            this.currency,
            this.vault,
            this.program.provider.publicKey,
            1_000_000,
            6,
            [],
            TOKEN_PROGRAM_ID,
        )

        await this.program.provider.sendAndConfirm(new Transaction().add(mintCurrencyToLpVault));

        this.collateralVault = getAssociatedTokenAddressSync(
            this.collateral,
            this.lpVault,
            true,
            TOKEN_PROGRAM_ID,
        );

        const collateralVaultAtaIx = createAssociatedTokenAccountIdempotentInstruction(
            superAdminProgram.provider.publicKey,
            this.collateralVault,
            this.lpVault,
            this.collateral,
            TOKEN_PROGRAM_ID
        );

        const permissionIx = await superAdminProgram.methods.initOrUpdatePermission({
            canCosignSwaps: false,
            canInitVaults: false,
            canLiquidate: false,
            canInitPools: false,
            canBorrowFromVaults: true,
            status: { active: {} }
        }).accounts({
            payer: superAdminProgram.provider.publicKey,
            newAuthority: this.BORROW_AUTHORITY.publicKey,
        }).instruction();

        const transferIx = SystemProgram.transfer({
            fromPubkey: NON_SWAP_AUTHORITY.publicKey,
            toPubkey: this.BORROW_AUTHORITY.publicKey,
            lamports: 10_000_000,
        });

        await superAdminProgram.methods.initOrUpdatePermission({
            canCosignSwaps: true,
            canInitVaults: true,
            canLiquidate: true,
            canInitPools: true,
            canBorrowFromVaults: false,
            status: { active: {} }
        }).accounts({
            payer: superAdminProgram.provider.publicKey,
            newAuthority: this.NON_BORROW_AUTHORITY.publicKey,
        })
            .signers([NON_SWAP_AUTHORITY])
            .preInstructions([permissionIx, collateralVaultAtaIx, transferIx])
            .rpc();

        const balance = await superAdminProgram.provider.connection.getBalance(this.BORROW_AUTHORITY.publicKey);
        console.log("Borrow authority balance: ", balance);

        // (optional) init strategy
        await validateSetup(this);

        return this;
    }
}

export const strategyDeposit = async (
    ctx: StrategyContext,
    {
        amountIn,
        amountOut,
    }: {
        amountIn: number,
        amountOut: number,
    }) => {
    await ctx.program.methods.strategyDepositCleanup()
        .accountsPartial(strategyAccounts(ctx))
        .preInstructions([
            await strategyDepositSetup(ctx, amountIn, amountOut),
            ...depositSwapInstructions(ctx, amountIn, amountOut)
        ])
        .signers([ctx.BORROW_AUTHORITY])
        .rpc();
}

export const strategyWithdraw = async (
    ctx: StrategyContext,
    {
        amountIn,
        amountOut,
    }: {
        amountIn: number,
        amountOut: number,
    }) => {
    await ctx.program.methods.strategyWithdrawCleanup()
        //@ts-ignore
        .accountsPartial(strategyAccounts(ctx))
        .preInstructions([
            await strategyWithdrawSetup(ctx, amountIn, amountOut),
            ...withdrawSwapInstructions(ctx, amountIn, amountOut)
        ])
        .signers([ctx.BORROW_AUTHORITY])
        .rpc();
};

export const accountStates = async (ctx: StrategyContext) => {
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
        lpVault: lpVaultState,
        strategy: strategyState,
        vault: vaultState,
        collateralVault: collateralVaultState,
    };
}

export const validateSetup = async (ctx: StrategyContext) => {
    await setupStrategy(ctx);

    try {
        const [
            strategyState,
            lpVaultState,
            collateralVaultState
        ] = await Promise.all([
            superAdminProgram.account.strategy.fetch(ctx.strategy),
            superAdminProgram.account.lpVault.fetch(ctx.lpVault),
            superAdminProgram.provider.connection.getAccountInfo(ctx.collateralVault),
        ]);

        assert(strategyState.collateralVault.equals(ctx.collateralVault));
        assert(strategyState.currency.equals(ctx.currency));
        assert(strategyState.collateral.equals(ctx.collateral));
        assert(strategyState.lpVault.equals(ctx.lpVault));
        assert.equal(strategyState.totalBorrowedAmount.toNumber(), 0);
        assert.equal(lpVaultState.totalBorrowed.toNumber(), 0);

        if (collateralVaultState) {
            assert.equal(
                AccountLayout.decode(collateralVaultState.data).amount, BigInt(0)
            );
        }

        return;
    } catch (err) {
        console.error(err);
    }
}

export const setupStrategy = async (ctx: StrategyContext) => {
    return await superAdminProgram.methods.initStrategy().accountsPartial({
        authority: ctx.BORROW_AUTHORITY.publicKey,
        permission: ctx.borrowPermission,
        lpVault: ctx.lpVault,
        vault: ctx.vault,
        currency: ctx.currency,
        collateral: ctx.collateral,
        strategy: ctx.strategy,
        collateralVault: ctx.collateralVault,
        systemProgram: SystemProgram.programId,
    })
        .signers([ctx.BORROW_AUTHORITY])
        .rpc();
}

export const depositSwapInstructions = (ctx: StrategyContext, x: number, y: number) => {
    const burnIx = createBurnInstruction(
        ctx.vault,
        ctx.currency,
        ctx.BORROW_AUTHORITY.publicKey,
        x
    );

    const mintIx = createMintToInstruction(
        ctx.collateral,
        ctx.collateralVault,
        ctx.program.provider.publicKey,
        y
    );

    return [burnIx, mintIx];
}

export const withdrawSwapInstructions = (ctx: StrategyContext, x: number, y: number) => {
    const burnIx = createBurnInstruction(
        ctx.collateralVault,
        ctx.collateral,
        ctx.BORROW_AUTHORITY.publicKey,
        x
    );

    const mintIx = createMintToInstruction(
        ctx.currency,
        ctx.vault,
        ctx.program.provider.publicKey,
        y
    );

    return [burnIx, mintIx];
};

export const strategyDepositSetup = async (ctx: StrategyContext, x: number, y: number) => {
    return await ctx.program.methods.strategyDepositSetup(
        new anchor.BN(x),
        new anchor.BN(y)
    ).accountsPartial(strategyAccounts(ctx)).instruction();
};

export const strategyWithdrawSetup = async (ctx: StrategyContext, x: number, y: number) => {
    return await ctx.program.methods.strategyWithdrawSetup(
        new anchor.BN(x),
        new anchor.BN(y)
    ).accountsPartial(strategyAccounts(ctx)).instruction();
};

export const strategyAccounts = (ctx: StrategyContext) => {
    return {
        authority: ctx.BORROW_AUTHORITY.publicKey,
        permission: ctx.borrowPermission,
        lpVault: ctx.lpVault,
        vault: ctx.vault,
        collateral: ctx.collateral,
        strategy: ctx.strategy,
        strategyRequest: ctx.strategyRequest,
        collateralVault: ctx.collateralVault,
        tokenProgram: TOKEN_PROGRAM_ID,
    }
};

export const validateWithdraw = async (
    ctx: StrategyContext,
    {
        amountIn,
        amountOut
    }: { amountIn: number, amountOut: number }) => {
    try {
        const statesBefore = accountStates(ctx);

        await strategyWithdraw(ctx, { amountIn, amountOut });

        await validateStates(
            statesBefore,
            accountStates(ctx),
            amountIn.toString()
        );
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
    const [before, after] = await Promise.all([beforePromise, afterPromise]);

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

export const strategyClaim = async (ctx: StrategyContext, newQuote: number) => {
    return await ctx.program
        .methods
        .strategyClaimYield(new anchor.BN(newQuote))
        .accountsPartial(claimAccounts(ctx))
        .signers([ctx.BORROW_AUTHORITY]).rpc();
}

export const strategyClaimIx = async (ctx: StrategyContext, newQuote: number) => {
    return ctx.program.methods.strategyClaimYield(new anchor.BN(newQuote))
        .accountsPartial(claimAccounts(ctx)).instruction()
}

export const claimAccounts = (ctx: StrategyContext) => {
    return {
        authority: ctx.BORROW_AUTHORITY.publicKey,
        permission: ctx.borrowPermission,
        lpVault: ctx.lpVault,
        collateral: ctx.collateral,
        strategy: ctx.strategy,
    };
}

export const validateClaim = async (ctx: StrategyContext, newQuote: number) => {
    const statesBefore = accountStates(ctx);
    try {
        await ctx.program.methods
            .strategyClaimYield(new anchor.BN(newQuote))
            .accountsPartial(claimAccounts(ctx))
            .signers([ctx.BORROW_AUTHORITY])
            .rpc();
        const statesAfter = accountStates(ctx);
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
    ctx: StrategyContext,
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
    await ctx.program.methods.strategyWithdrawCleanup()
        .accountsPartial(strategyAccounts(ctx))
        .preInstructions([
            await strategyWithdrawSetup(ctx, amountIn, amountOut),
            await strategyClaimIx(ctx, newQuote),
            ...withdrawSwapInstructions(ctx, amountIn, amountOut)
        ])
        .signers([ctx.BORROW_AUTHORITY])
        .rpc();
};

export const strategyWithdrawClaimAfter = async (
    ctx: StrategyContext,
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
    await ctx.program.methods.strategyWithdrawCleanup()
        .accountsPartial(strategyAccounts(ctx))
        .preInstructions([
            await strategyWithdrawSetup(ctx, amountIn, amountOut),
            ...withdrawSwapInstructions(ctx, amountIn, amountOut),
            await strategyClaimIx(ctx, newQuote),
        ])
        .signers([ctx.BORROW_AUTHORITY])
        .rpc();
};


export const closeStrategy = async (ctx: StrategyContext) => {
    await ctx.program.methods
        .closeStrategy()
        .accountsPartial({
            authority: ctx.BORROW_AUTHORITY.publicKey,
            permission: ctx.borrowPermission,
            lpVault: ctx.lpVault,
            collateral: ctx.collateral,
            strategy: ctx.strategy,
            collateralVault: ctx.collateralVault,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([ctx.BORROW_AUTHORITY]).rpc();
    assert.isNull(
        await superAdminProgram.account.strategy.fetchNullable(ctx.strategy)
    );
}


export const mochaHooks = {
    beforeAll: async () => {
        await setupTestEnvironment();
        await initWasabi();
    },
}
