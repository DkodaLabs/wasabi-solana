import * as anchor from '@coral-xyz/anchor';
import { assert } from 'chai';
import { Keypair, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
    AccountLayout,
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountIdempotentInstruction,
    TOKEN_2022_PROGRAM_ID,
    createBurnInstruction,
    createMintToInstruction,
} from '@solana/spl-token';
import {
    WASABI_PROGRAM_ID,
    superAdminProgram,
    NON_SWAP_AUTHORITY
} from '../hooks/rootHook';
import { TestContext } from '../hooks/tester';

export class StrategyContext extends TestContext {
    collateralVault: PublicKey;
    strategy: PublicKey;
    strategyRequest: PublicKey;
    strategyClaimListener: number;
    strategyWithdrawListener: number;
    strategyDepositListener: number;
    strategyClaimEvent;
    strategyWithdrawEvent;
    strategyDepositEvent;

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
        await this.strategyDeposit({ amountIn, amountOut });

        return this;
    }

    async generateWithdrawTestDefault() {
        await this.generate();
        await this.strategyDeposit({ amountIn: 1_000, amountOut: 800 });

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

        const [sharesMint] = PublicKey.findProgramAddressSync(
            [
                this.lpVault.toBuffer(), this.currency.toBuffer()
            ],
            WASABI_PROGRAM_ID
        );

        const ownerSharesAta = getAssociatedTokenAddressSync(
            sharesMint,
            this.program.provider.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID,
        );

        const createOwnerSharesAccount = createAssociatedTokenAccountIdempotentInstruction(
            this.program.provider.publicKey,
            ownerSharesAta,
            this.program.provider.publicKey,
            sharesMint,
            TOKEN_2022_PROGRAM_ID
        );

        await this.program.methods.deposit(new anchor.BN(5_000 * LAMPORTS_PER_SOL)).accountsPartial({
            owner: this.program.provider.publicKey,
            lpVault: this.lpVault,
            assetMint: this.currency,
            assetTokenProgram: TOKEN_PROGRAM_ID
        }).preInstructions([createOwnerSharesAccount]).rpc();

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

        this.strategyClaimListener = this.program.addEventListener('strategyClaim', (event) => {
            this.strategyClaimEvent = event;
        });

        this.strategyWithdrawListener = this.program.addEventListener('strategyWithdraw', (event) => {
            this.strategyWithdrawEvent = event;
        });

        this.strategyDepositListener = this.program.addEventListener('strategyDeposit', (event) => {
            this.strategyDepositEvent = event;
        });

        // (optional) init strategy
        await this.validateSetup();

        return this;
    }

    async validateSetup() {
        await this.setupStrategy();
        const [
            strategyState,
            lpVaultState,
            collateralVaultState
        ] = await Promise.all([
            superAdminProgram.account.strategy.fetch(this.strategy),
            superAdminProgram.account.lpVault.fetch(this.lpVault),
            superAdminProgram.provider.connection.getAccountInfo(this.collateralVault),
        ]);

        assert(strategyState.collateralVault.equals(this.collateralVault));
        assert(strategyState.currency.equals(this.currency));
        assert(strategyState.collateral.equals(this.collateral));
        assert(strategyState.lpVault.equals(this.lpVault));
        assert.equal(strategyState.totalBorrowedAmount.toNumber(), 0);
        assert.equal(lpVaultState.totalBorrowed.toNumber(), 0);

        if (collateralVaultState) {
            assert.equal(
                AccountLayout.decode(collateralVaultState.data).amount, BigInt(0)
            );
        }

        return;
    }

    async setupStrategy() {
        return await superAdminProgram.methods.initStrategy().accountsPartial({
            authority: this.BORROW_AUTHORITY.publicKey,
            permission: this.borrowPermission,
            lpVault: this.lpVault,
            vault: this.vault,
            currency: this.currency,
            collateral: this.collateral,
            strategy: this.strategy,
            collateralVault: this.collateralVault,
            systemProgram: SystemProgram.programId,
        })
            .signers([this.BORROW_AUTHORITY])
            .rpc();
    }


    getStrategyAccounts() {
        return {
            authority: this.BORROW_AUTHORITY.publicKey,
            permission: this.borrowPermission,
            lpVault: this.lpVault,
            vault: this.vault,
            collateral: this.collateral,
            strategy: this.strategy,
            strategyRequest: this.strategyRequest,
            collateralVault: this.collateralVault,
            tokenProgram: TOKEN_PROGRAM_ID,
        }
    };

    getClaimAccounts() {
        return {
            authority: this.BORROW_AUTHORITY.publicKey,
            permission: this.borrowPermission,
            lpVault: this.lpVault,
            collateral: this.collateral,
            strategy: this.strategy,
        };
    }

    async strategyDeposit(
        this: StrategyContext,
        {
            amountIn,
            amountOut,
        }: {
            amountIn: number,
            amountOut: number,
        }) {
        const actualAmountIn = amountIn * anchor.web3.LAMPORTS_PER_SOL;
        const actualAmountOut = amountOut * anchor.web3.LAMPORTS_PER_SOL;

        await this.program.methods.strategyDepositCleanup()
            .accountsPartial(this.getStrategyAccounts())
            .preInstructions([
                await this.strategyDepositSetup(actualAmountIn, actualAmountOut),
                ...this.depositSwapInstructions(actualAmountIn, actualAmountOut)
            ])
            .signers([this.BORROW_AUTHORITY])
            .rpc();
    }

    async strategyWithdraw(
        {
            amountIn,
            amountOut,
        }: {
            amountIn: number,
            amountOut: number,
        }) {
        const actualAmountIn = amountIn * anchor.web3.LAMPORTS_PER_SOL;
        const actualAmountOut = amountOut * anchor.web3.LAMPORTS_PER_SOL;

        await this.program.methods.strategyWithdrawCleanup()
            .accountsPartial(this.getStrategyAccounts())
            .preInstructions([
                await this.strategyWithdrawSetup(actualAmountIn, actualAmountOut),
                ...this.withdrawSwapInstructions(actualAmountIn, actualAmountOut)
            ])
            .signers([this.BORROW_AUTHORITY])
            .rpc();
    };


    async strategyDepositSetup(x: number, y: number) {
        return await this.program.methods.strategyDepositSetup(
            new anchor.BN(x),
            new anchor.BN(y)
        ).accountsPartial(this.getStrategyAccounts()).instruction();
    };

    async strategyWithdrawSetup(x: number, y: number) {
        return await this.program.methods.strategyWithdrawSetup(
            new anchor.BN(x),
            new anchor.BN(y)
        ).accountsPartial(this.getStrategyAccounts()).instruction();
    };

    depositSwapInstructions(this: StrategyContext, x: number, y: number) {
        const burnIx = createBurnInstruction(
            this.vault,
            this.currency,
            this.BORROW_AUTHORITY.publicKey,
            x
        );

        const mintIx = createMintToInstruction(
            this.collateral,
            this.collateralVault,
            this.program.provider.publicKey,
            y
        );

        return [burnIx, mintIx];
    }

    withdrawSwapInstructions(x: number, y: number) {
        const burnIx = createBurnInstruction(
            this.collateralVault,
            this.collateral,
            this.BORROW_AUTHORITY.publicKey,
            x
        );

        const mintIx = createMintToInstruction(
            this.currency,
            this.vault,
            this.program.provider.publicKey,
            y
        );

        return [burnIx, mintIx];
    };

    async strategyClaim(this: StrategyContext, newQuote: number) {
        return await this.program
            .methods
            .strategyClaimYield(new anchor.BN(newQuote))
            .accountsPartial(this.getClaimAccounts())
            .signers([this.BORROW_AUTHORITY]).rpc();
    }

    async strategyClaimIx(this: StrategyContext, newQuote: number) {
        return this.program.methods.strategyClaimYield(new anchor.BN(newQuote))
            .accountsPartial(this.getClaimAccounts()).instruction()
    }

    async closeStrategy() {
        await this.program.methods
            .closeStrategy()
            .accountsPartial({
                authority: this.BORROW_AUTHORITY.publicKey,
                permission: this.borrowPermission,
                lpVault: this.lpVault,
                collateral: this.collateral,
                strategy: this.strategy,
                collateralVault: this.collateralVault,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([this.BORROW_AUTHORITY]).rpc();
        assert.isNull(
            await superAdminProgram.account.strategy.fetchNullable(this.strategy)
        );
    }
}
