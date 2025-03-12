import * as anchor from '@coral-xyz/anchor';
import {Keypair, PublicKey, TransactionInstruction} from '@solana/web3.js';
import {TradeContext} from '../04_trade-tests/tradeContext';
import {WASABI_PROGRAM_ID} from "../hooks/rootHook";
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {AnchorError, ProgramError} from "@coral-xyz/anchor";

export interface OrderInitArgs {
    makerAmount?: bigint;
    takerAmount?: bigint;
}

export interface OrderArgs {
    interest: bigint;
    executionFee: bigint;
    swapIn: bigint;
    swapOut: bigint;
}

export const defaultInitTakeProfitOrderArgs = <OrderInitArgs>{
    makerAmount: BigInt(100),
    takerAmount: BigInt(200),
}

export const defaultInitStopLossOrderArgs = <OrderInitArgs>{
    makerAmount: BigInt(100),
    takerAmount: BigInt(2_000),
}

export const defaultTakeProfitOrderArgs = <OrderArgs>{
    interest:     BigInt(10),
    executionFee: BigInt(11),
    swapIn:       BigInt(1_900),
    swapOut:      BigInt(2_000),
};

export const defaultStopLossOrderArgs = <OrderArgs>{
    interest:     BigInt(10),
    executionFee: BigInt(11),
    swapIn:       BigInt(1_900),
    swapOut:      BigInt(2_000),
};

export class OrderContext extends TradeContext {
    takeProfitListener: number;
    stopLossListener: number;
    takeProfitEvent;
    stopLossEvent;

    longTakeProfitOrder: PublicKey;
    shortTakeProfitOrder: PublicKey;
    longStopLossOrder: PublicKey;
    shortStopLossOrder: PublicKey;

    isLong = true;
    useTrader = true;

    constructor(
        readonly ORDER_AUTHORITY = Keypair.generate(),
        readonly NON_ORDER_AUTHORITY = Keypair.generate(),
        readonly orderPermission = PublicKey.findProgramAddressSync([
            anchor.utils.bytes.utf8.encode('admin'),
            ORDER_AUTHORITY.publicKey.toBuffer(),
        ], WASABI_PROGRAM_ID)[0],
        readonly nonOrderPermission = PublicKey.findProgramAddressSync([
            anchor.utils.bytes.utf8.encode('admin'),
            NON_ORDER_AUTHORITY.publicKey.toBuffer(),
        ], WASABI_PROGRAM_ID)[0],
    ) {
        super();
    }

    async generateLongTestWithDefaultPosition(): Promise<this> {
        await super.generateLongTestWithDefaultPosition();

        this.longTakeProfitOrder = PublicKey.findProgramAddressSync([
            anchor.utils.bytes.utf8.encode('take_profit_order'),
            this.longPosition.toBuffer(),
        ], WASABI_PROGRAM_ID)[0];

        this.longStopLossOrder = PublicKey.findProgramAddressSync([
            anchor.utils.bytes.utf8.encode('stop_loss_order'),
            this.longPosition.toBuffer(),
        ], WASABI_PROGRAM_ID)[0];

        this.takeProfitListener = this.program.addEventListener('positionClosedWithOrder', (event) => {
            if (event.orderType === 0) { // Take profit order type
                this.takeProfitEvent = event;
            }
        });

        this.stopLossListener = this.program.addEventListener('positionClosedWithOrder', (event) => {
            if (event.orderType === 1) { // Stop loss order type
                this.stopLossEvent = event;
            }
        });

        return this;
    }

    async generateShortTestWithDefaultPosition(): Promise<this> {
        await super.generateShortTestWithDefaultPosition();

        this.shortTakeProfitOrder = PublicKey.findProgramAddressSync([
            anchor.utils.bytes.utf8.encode('take_profit_order'),
            this.shortPosition.toBuffer(),
        ], WASABI_PROGRAM_ID)[0];

        this.shortStopLossOrder = PublicKey.findProgramAddressSync([
            anchor.utils.bytes.utf8.encode('stop_loss_order'),
            this.shortPosition.toBuffer(),
        ], WASABI_PROGRAM_ID)[0];

        this.takeProfitListener = this.program.addEventListener('positionClosedWithOrder', (event) => {
            if (event.orderType === 0) { // Take profit order type
                this.takeProfitEvent = event;
            }
        });

        this.stopLossListener = this.program.addEventListener('positionClosedWithOrder', (event) => {
            if (event.orderType === 1) { // Stop loss order type
                this.stopLossEvent = event;
            }
        });

        return this;
    }

    // Take Profit Order methods
    async initTakeProfitOrder({
        makerAmount,
        takerAmount,
    }: OrderInitArgs = defaultInitTakeProfitOrderArgs) {
        const position = this.isLong ? this.longPosition : this.shortPosition;

        return await this.program.methods
            .initOrUpdateTakeProfitOrder(
                new anchor.BN(makerAmount.toString()),
                new anchor.BN(takerAmount.toString()),
            )
            .accounts({
                //@ts-ignore
                trader:   this.program.provider.publicKey,
                position: position,
            })
            .instruction();
    }

    async executeTakeProfitOrder({
        interest,
        executionFee,
        swapIn,
        swapOut,
    }: OrderArgs = defaultTakeProfitOrderArgs) {
        const instructions = await Promise.all([
            this.takeProfitSetup({interest, executionFee}),
            this.isLong ?
                this.createBASwapIx({
                    swapIn,
                    swapOut,
                    poolAtaA: this.longPoolCurrencyVault,
                    poolAtaB: this.longPoolCollateralVault
                }) :
                this.createABSwapIx({
                    swapIn,
                    swapOut,
                    poolAtaA: this.shortPoolCurrencyVault,
                    poolAtaB: this.shortPoolCollateralVault
                }),
            this.takeProfitCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        return await this.send(instructions, this.ORDER_AUTHORITY);
    }

    async takeProfitSetup({
        interest,
        executionFee,
    }: {
        interest: bigint,
        executionFee: bigint,
    }) {
        const expiration = Date.now() / 1_000 + 60 * 60;
        const position = this.isLong ? this.longPosition : this.shortPosition;
        const pool = this.isLong ? this.longPool : this.shortPool;

        return await this.program.methods
            .takeProfitSetup(
                new anchor.BN(0), // minTargetAmount
                new anchor.BN(interest.toString()),
                new anchor.BN(executionFee.toString()),
                new anchor.BN(expiration)
            )
            .accounts({
                closePositionSetup: {
                    owner:      this.program.provider.publicKey,
                    position:   position,
                    pool:       pool,
                    collateral: this.collateral,
                    //@ts-ignore
                    authority:    this.ORDER_AUTHORITY.publicKey,
                    permission:   this.orderPermission,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            })
            .instruction();
    }

    async takeProfitCleanup() {
        const position = this.isLong ? this.longPosition : this.shortPosition;
        const pool = this.isLong ? this.longPool : this.shortPool;
        const takeProfitOrder = this.isLong ? this.longTakeProfitOrder : this.shortTakeProfitOrder;

        return await this.program.methods.takeProfitCleanup()
            .accounts({
                closePositionCleanup: {
                    //@ts-ignore
                    owner:                  this.program.provider.publicKey,
                    ownerPayoutAccount:     this.ownerCurrencyAta,
                    position:               position,
                    pool:                   pool,
                    currency:               this.currency,
                    collateral:             this.collateral,
                    authority:              this.ORDER_AUTHORITY.publicKey,
                    lpVault:                this.lpVault,
                    feeWallet:              this.feeWallet,
                    liquidationWallet:      this.liquidationWallet,
                    currencyTokenProgram:   TOKEN_PROGRAM_ID,
                    collateralTokenProgram: TOKEN_PROGRAM_ID,
                },
                takeProfitOrder:      takeProfitOrder,
            })
            .instruction();
    }

    async cancelTakeProfitOrder() {
        const position = this.isLong ? this.longPosition : this.shortPosition;

        return await this.program.methods
            .closeTakeProfitOrder()
            .accounts({
                closer: this.useTrader ? this.program.provider.publicKey : this.ORDER_AUTHORITY.publicKey,
                //@ts-ignore
                trader:     this.program.provider.publicKey,
                permission: this.orderPermission,
                position:   position,
            })
            .instruction();
    }

    // Stop Loss Order methods
    async initStopLossOrder({
        makerAmount,
        takerAmount,
    }: OrderInitArgs = defaultInitStopLossOrderArgs) {
        const position = this.isLong ? this.longPosition : this.shortPosition;

        return await this.program.methods
            .initOrUpdateStopLossOrder(
                new anchor.BN(makerAmount.toString()),
                new anchor.BN(takerAmount.toString()),
            )
            .accounts({
                //@ts-ignore
                trader:   this.program.provider.publicKey,
                position: position,
            })
            .instruction();
    }

    async executeStopLossOrder({
        interest,
        executionFee,
        swapIn,
        swapOut,
    }: OrderArgs = defaultStopLossOrderArgs) {
        const instructions = await Promise.all([
            this.stopLossSetup({interest, executionFee}),
            this.isLong ?
                this.createBASwapIx({
                    swapIn,
                    swapOut,
                    poolAtaA: this.longPoolCurrencyVault,
                    poolAtaB: this.longPoolCollateralVault
                }) :
                this.createABSwapIx({
                    swapIn,
                    swapOut,
                    poolAtaA: this.shortPoolCurrencyVault,
                    poolAtaB: this.shortPoolCollateralVault
                }),
            this.stopLossCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        return await this.send(instructions, this.ORDER_AUTHORITY);
    }

    async stopLossSetup({
        interest,
        executionFee,
    }: {
        interest: bigint,
        executionFee: bigint,
    }) {
        const expiration = Date.now() / 1_000 + 60 * 60;
        const position = this.isLong ? this.longPosition : this.shortPosition;
        const pool = this.isLong ? this.longPool : this.shortPool;

        return await this.program.methods
            .stopLossSetup(
                new anchor.BN(0), // minTargetAmount
                new anchor.BN(interest.toString()),
                new anchor.BN(executionFee.toString()),
                new anchor.BN(expiration)
            )
            .accounts({
                closePositionSetup: {
                    owner:      this.program.provider.publicKey,
                    position:   position,
                    pool:       pool,
                    collateral: this.collateral,
                    //@ts-ignore
                    authority:    this.ORDER_AUTHORITY.publicKey,
                    permission:   this.orderPermission,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            })
            .instruction();
    }

    async stopLossCleanup() {
        const position = this.isLong ? this.longPosition : this.shortPosition;
        const pool = this.isLong ? this.longPool : this.shortPool;
        const stopLossOrder = this.isLong ? this.longStopLossOrder : this.shortStopLossOrder;

        return await this.program.methods.stopLossCleanup()
            .accounts({
                closePositionCleanup: {
                    //@ts-ignore
                    owner:                  this.program.provider.publicKey,
                    ownerPayoutAccount:     this.ownerCurrencyAta,
                    position:               position,
                    pool:                   pool,
                    currency:               this.currency,
                    collateral:             this.collateral,
                    authority:              this.ORDER_AUTHORITY.publicKey,
                    lpVault:                this.lpVault,
                    feeWallet:              this.feeWallet,
                    liquidationWallet:      this.liquidationWallet,
                    currencyTokenProgram:   TOKEN_PROGRAM_ID,
                    collateralTokenProgram: TOKEN_PROGRAM_ID,
                },
                stopLossOrder:        stopLossOrder,
            })
            .instruction();
    }

    async cancelStopLossOrder() {
        const position = this.isLong ? this.longPosition : this.shortPosition;

        return await this.program.methods
            .closeStopLossOrder()
            .accounts({
                closer: this.useTrader ? this.program.provider.publicKey : this.ORDER_AUTHORITY.publicKey,
                //@ts-ignore
                trader:     this.program.provider.publicKey,
                permission: this.orderPermission,
                position:   position,
            })
            .instruction();
    }
}
