import * as anchor from '@coral-xyz/anchor';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { TradeContext } from '../04_trade-tests/tradeContext';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface LiquidationArgs {
    minOut: bigint;
    interest: bigint;
    executionFee: bigint;
    swapIn: bigint;
    swapOut: bigint;
    authority: PublicKey;
}

export const defaultLiquidateLongPositionArgs = <LiquidationArgs>{
    minOut: BigInt(0),
    interest: BigInt(1),
    executionFee: BigInt(11),
    swapIn: BigInt(1_900),
    swapOut: BigInt(1_050),
};

export const defaultLiquidateShortPositionArgs = <LiquidationArgs>{
    minOut: BigInt(0),
    interest: BigInt(1),
    executionFee: BigInt(11),
    swapIn: BigInt(170),
    swapOut: BigInt(1001),
};

export class LiquidationContext extends TradeContext {
    liquidationListener: number;
    liquidationEvent;

    constructor() {
        super();
    }

    async generateLongOrderTest(): Promise<this> {
        await super.generateLongTestWithDefaultPosition();
        return await this.generateLiquidationContext();
    }

    async generateShortOrderTest(): Promise<this> {
        await super.generateShortTestWithDefaultPosition();
        return await this.generateLiquidationContext();
    }

    async generateLiquidationContext() {
        this.liquidationListener = this.program.addEventListener('positionLiquidated', (event) => {
            this.liquidationEvent = event;
        });

        return this;
    }

    async liquidateLongPosition({
        minOut,
        interest,
        executionFee,
        swapIn,
        swapOut,
        authority,
    }: LiquidationArgs = defaultLiquidateLongPositionArgs) {
        const instructions = await Promise.all([
            this.liquidateLongPositionSetup({ minOut, interest, executionFee }),
            this.createBASwapIx({
                swapIn,
                swapOut,
                poolAtaA: this.longPoolCurrencyVault,
                poolAtaB: this.longPoolCollateralVault,
                authority,
            }),
            this.liquidateLongPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        return await this.send(instructions, this.SWAP_AUTHORITY);
    }

    async liquidateShortPosition({
        minOut,
        interest,
        executionFee,
        swapIn,
        swapOut,
        authority,
    }: LiquidationArgs = defaultLiquidateShortPositionArgs) {
        const instructions = await Promise.all([
            this.liquidateShortPositionSetup({ minOut, interest, executionFee }),
            this.createBASwapIx({
                swapIn,
                swapOut,
                poolAtaA: this.shortPoolCurrencyVault,
                poolAtaB: this.shortPoolCollateralVault,
                authority,
            }),
            this.liquidateShortPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        return await this.send(instructions, this.SWAP_AUTHORITY);
    }

    async liquidateLongPositionSetup({
        minOut,
        interest,
        executionFee,
    }: {
        minOut: bigint,
        interest: bigint,
        executionFee: bigint,
    }) {
        const expiration = Date.now() / 1_000 + 60 * 60;

        return await this.program.methods
            .liquidatePositionSetup(
                new anchor.BN(minOut.toString()),
                new anchor.BN(interest.toString()),
                new anchor.BN(executionFee.toString()),
                new anchor.BN(expiration)
            ).accountsPartial({
                closePositionSetup: {
                    owner: this.program.provider.publicKey,
                    position: this.longPosition,
                    pool: this.longPool,
                    collateral: this.collateral,
                    authority: this.SWAP_AUTHORITY.publicKey,
                    permission: this.swapPermission,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }).instruction();
    }

    async liquidateLongPositionCleanup(authority: PublicKey = this.SWAP_AUTHORITY.publicKey) {
        return await this.program.methods.liquidatePositionCleanup().accountsPartial({
            closePositionCleanup: {
                owner: this.program.provider.publicKey,
                ownerPayoutAccount: this.ownerCurrencyAta,
                position: this.longPosition,
                pool: this.longPool,
                currency: this.currency,
                collateral: this.collateral,
                authority,
                lpVault: this.lpVault,
                feeWallet: this.feeWallet,
                liquidationWallet: this.liquidationWallet,
                currencyTokenProgram: TOKEN_PROGRAM_ID,
                collateralTokenProgram: TOKEN_PROGRAM_ID,
            },
        }).instruction();
    }

    async liquidateShortPositionSetup({
        minOut,
        interest,
        executionFee,
    }: {
        minOut: bigint,
        interest: bigint,
        executionFee: bigint,
    }) {
        const expiration = Date.now() / 1_000 + 60 * 60;

        return await this.program.methods.liquidatePositionSetup(
            new anchor.BN(minOut.toString()),
            new anchor.BN(interest.toString()),
            new anchor.BN(executionFee.toString()),
            new anchor.BN(expiration)
        ).accountsPartial({
            closePositionSetup: {
                owner: this.program.provider.publicKey,
                position: this.shortPosition,
                pool: this.shortPool,
                collateral: this.collateral,
                authority: this.SWAP_AUTHORITY.publicKey,
                permission: this.swapPermission,
                tokenProgram: TOKEN_PROGRAM_ID,
            }
        }).instruction();
    }

    async liquidateShortPositionCleanup(authority: PublicKey = this.SWAP_AUTHORITY.publicKey) {
        return await this.program.methods.liquidatePositionCleanup().accountsPartial({
            closePositionCleanup: {
                owner: this.program.provider.publicKey,
                ownerPayoutAccount: this.ownerCollateralAta,
                position: this.shortPosition,
                pool: this.shortPool,
                collateral: this.collateral,
                currency: this.currency,
                authority,
                lpVault: this.lpVault,
                feeWallet: this.feeWallet,
                liquidationWallet: this.liquidationWallet,
                collateralTokenProgram: TOKEN_PROGRAM_ID,
                currencyTokenProgram: TOKEN_PROGRAM_ID,
            }
        }).instruction();
    }
}
