import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { TradeContext } from '../04_trade-tests/tradeContext';
import { WASABI_PROGRAM_ID } from "../hooks/rootHook";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface LiquidationArgs {
    minOut: bigint;
    interest: bigint;
    executionFee: bigint;
    swapIn: bigint;
    swapOut: bigint;
}

export const defaultLiquidateLongPositionArgs = <LiquidationArgs>{
    minOut: BigInt(0),
    interest: BigInt(10),
    executionFee: BigInt(11),
    swapIn: BigInt(1_900),
    swapOut: BigInt(2_000),
};

export const defaultLiquidateShortPositionArgs = <LiquidationArgs>{
    minOut: BigInt(0),
    interest: BigInt(10),
    executionFee: BigInt(11),
    swapIn: BigInt(1_000),
    swapOut: BigInt(1_100),
};

export class LiquidationContext extends TradeContext {
    liquidationListener: number;
    liquidationEvent;
    
    constructor(
        readonly LIQUIDATOR_AUTHORITY = Keypair.generate(),
        readonly NON_LIQUIDATOR_AUTHORITY = Keypair.generate(),
        readonly liquidatorPermission = PublicKey.findProgramAddressSync([
            anchor.utils.bytes.utf8.encode('admin'),
            LIQUIDATOR_AUTHORITY.publicKey.toBuffer(),
        ], WASABI_PROGRAM_ID)[0],
        readonly nonLiquidatorPermission = PublicKey.findProgramAddressSync([
            anchor.utils.bytes.utf8.encode('admin'),
            NON_LIQUIDATOR_AUTHORITY.publicKey.toBuffer(),
        ], WASABI_PROGRAM_ID)[0],
    ) {
        super();
    }

    async generateLongTestWithDefaultPosition(): Promise<this> {
        await super.generateLongTestWithDefaultPosition();
        this.liquidationListener = this.program.addEventListener('positionLiquidated', (event) => { 
            this.liquidationEvent = event;
        });
        return this;
    }

    async generateShortTestWithDefaultPosition(): Promise<this> {
        await super.generateShortTestWithDefaultPosition();
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
    }: LiquidationArgs = defaultLiquidateLongPositionArgs) {
        const instructions = await Promise.all([
            this.liquidateLongPositionSetup({ minOut, interest, executionFee }),
            this.createBASwapIx({
                swapIn,
                swapOut,
                poolAtaA: this.longPoolCurrencyVault,
                poolAtaB: this.longPoolCollateralVault
            }),
            this.liquidateLongPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        return await this.send(instructions, this.LIQUIDATOR_AUTHORITY);
    }

    async liquidateShortPosition({
        minOut,
        interest,
        executionFee,
        swapIn,
        swapOut,
    }: LiquidationArgs = defaultLiquidateShortPositionArgs) {
        const instructions = await Promise.all([
            this.liquidateShortPositionSetup({ minOut, interest, executionFee }),
            this.createABSwapIx({
                swapIn,
                swapOut,
                poolAtaA: this.shortPoolCurrencyVault,
                poolAtaB: this.shortPoolCollateralVault
            }),
            this.liquidateShortPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        return await this.send(instructions, this.LIQUIDATOR_AUTHORITY);
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
                    authority: this.LIQUIDATOR_AUTHORITY.publicKey,
                    permission: this.liquidatorPermission,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }).instruction();
    }

    async liquidateLongPositionCleanup() {
        return await this.program.methods.liquidatePositionCleanup().accountsPartial({
            closePositionCleanup: {
                owner: this.program.provider.publicKey,
                ownerPayoutAccount: this.ownerCurrencyAta,
                position: this.longPosition,
                pool: this.longPool,
                currency: this.currency,
                collateral: this.collateral,
                authority: this.LIQUIDATOR_AUTHORITY.publicKey,
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
                authority: this.LIQUIDATOR_AUTHORITY.publicKey,
                permission: this.liquidatorPermission,
                tokenProgram: TOKEN_PROGRAM_ID,
            }
        }).instruction();
    }

    async liquidateShortPositionCleanup() {
        return await this.program.methods.liquidatePositionCleanup().accountsPartial({
            closePositionCleanup: {
                owner: this.program.provider.publicKey,
                ownerPayoutAccount: this.ownerCollateralAta,
                position: this.shortPosition,
                pool: this.shortPool,
                collateral: this.collateral,
                currency: this.currency,
                authority: this.LIQUIDATOR_AUTHORITY.publicKey,
                lpVault: this.lpVault,
                feeWallet: this.feeWallet,
                liquidationWallet: this.liquidationWallet,
                collateralTokenProgram: TOKEN_PROGRAM_ID,
                currencyTokenProgram: TOKEN_PROGRAM_ID,
            }
        }).instruction();
    }
}
