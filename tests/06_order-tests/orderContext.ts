import * as anchor from '@coral-xyz/anchor';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { TradeContext } from '../04_trade-tests/tradeContext';
import { WASABI_PROGRAM_ID } from "../hooks/rootHook";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface OrderInitArgs {
    makerAmount?: bigint;
    takerAmount?: bigint;
}

export interface OrderArgs {
    interest?: bigint;
    executionFee?: bigint;
    swapIn?: bigint;
    swapOut?: bigint;
}

export const defaultInitTakeProfitOrderArgs = <OrderInitArgs>{
    makerAmount: BigInt(100),
    takerAmount: BigInt(200),
}

export const defaultInitStopLossOrderArgs = <OrderInitArgs>{
    makerAmount: BigInt(100),
    takerAmount: BigInt(2_000),
}

export const defaultLongTakeProfitOrderArgs = <OrderArgs>{
    interest: BigInt(1),
    executionFee: BigInt(11),
    swapIn: BigInt(1_900),
    swapOut: BigInt(2_100),
};

export const defaultShortTakeProfitOrderArgs = <OrderArgs>{
    interest: BigInt(1),
    executionFee: BigInt(11),
    swapIn: BigInt(70),
    swapOut: BigInt(1001),
};

export const defaultStopLossOrderArgs = <OrderArgs>{
    interest: BigInt(10),
    executionFee: BigInt(11),
    swapIn: BigInt(100),
    swapOut: BigInt(1101),
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

    useTrader = true;

    constructor() {
        super();
    }

    async generateLongOrderTest(): Promise<this> {
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

    async generateShortOrderTest(): Promise<this> {
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
    }: OrderInitArgs) {
        const position = this.isLongTest ? this.longPosition : this.shortPosition;
        const takeProfitOrder = this.isLongTest ? this.longTakeProfitOrder : this.shortTakeProfitOrder;

        return await this.program.methods
            .initOrUpdateTakeProfitOrder(
                new anchor.BN(makerAmount.toString()),
                new anchor.BN(takerAmount.toString())
            )
            .accountsPartial({
                //@ts-ignore
                trader: this.program.provider.publicKey,
                position,
                takeProfitOrder,
            })
            .rpc();
    }

    async executeTakeProfitOrder({
        interest,
        executionFee,
        swapIn,
        swapOut,
    }: OrderArgs = defaultLongTakeProfitOrderArgs) {
        const instructions = await Promise.all([
            this.takeProfitSetup({ interest, executionFee }),
            this.isLongTest ?
                this.createBASwapIx({
                    swapIn,
                    swapOut,
                    poolAtaA: this.longPoolCurrencyVault,
                    poolAtaB: this.longPoolCollateralVault
                }) :
                this.createBASwapIx({
                    swapIn,
                    swapOut,
                    poolAtaA: this.shortPoolCurrencyVault,
                    poolAtaB: this.shortPoolCollateralVault
                }),
            this.takeProfitCleanup(this.SWAP_AUTHORITY)
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        return await this.send(instructions, this.SWAP_AUTHORITY);
    }

    async takeProfitSetup({
        interest,
        executionFee,
    }: {
        interest: bigint,
        executionFee: bigint,
    }) {
        const expiration = Date.now() / 1_000 + 60 * 60;
        const position = this.isLongTest ? this.longPosition : this.shortPosition;
        const pool = this.isLongTest ? this.longPool : this.shortPool;

        return await this.program.methods
            .takeProfitSetup(
                new anchor.BN(0), // minTargetAmount
                new anchor.BN(interest.toString()),
                new anchor.BN(executionFee.toString()),
                new anchor.BN(expiration)
            )
            .accounts({
                closePositionSetup: {
                    owner: this.program.provider.publicKey,
                    position: position,
                    pool: pool,
                    collateral: this.collateral,
                    //@ts-ignore
                    authority: this.SWAP_AUTHORITY.publicKey,
                    permission: this.swapPermission,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            })
            .instruction();
    }

    async takeProfitCleanup(signer: anchor.web3.Keypair) {
        const [position, pool, takeProfitOrder, ownerPayoutAccount] = this.isLongTest ?
            [this.longPosition, this.longPool, this.longTakeProfitOrder, this.ownerCurrencyAta] :
            [this.shortPosition, this.shortPool, this.shortTakeProfitOrder, this.ownerCollateralAta];


        return await this.program.methods.takeProfitCleanup()
            .accounts({
                closePositionCleanup: {
                    //@ts-ignore
                    owner: this.program.provider.publicKey,
                    ownerPayoutAccount,
                    position: position,
                    pool: pool,
                    currency: this.currency,
                    collateral: this.collateral,
                    authority: signer.publicKey,
                    lpVault: this.lpVault,
                    feeWallet: this.feeWallet,
                    liquidationWallet: this.liquidationWallet,
                    currencyTokenProgram: TOKEN_PROGRAM_ID,
                    collateralTokenProgram: TOKEN_PROGRAM_ID,
                },
                takeProfitOrder: takeProfitOrder,
            })
            .instruction();
    }

    async cancelTakeProfitOrder(signer?: anchor.web3.Keypair) {
        const position = this.isLongTest ? this.longPosition : this.shortPosition;
        const closer = this.useTrader ? this.program.provider.publicKey : this.SWAP_AUTHORITY.publicKey;

        const baseMethodCall = this.program.methods.closeTakeProfitOrder().accounts({
            closer,
            //@ts-ignore
            trader: this.program.provider.publicKey,
            permission: this.swapPermission,
            position: position,
        });

        if (signer) {
            return await baseMethodCall.signers([signer]).rpc();
        } else {
            return await baseMethodCall.rpc();
        }
    }

    // Stop Loss Order methods
    async initStopLossOrder({
        makerAmount,
        takerAmount,
    }: OrderInitArgs = defaultInitStopLossOrderArgs) {
        const position = this.isLongTest ? this.longPosition : this.shortPosition;

        return await this.program.methods
            .initOrUpdateStopLossOrder(
                new anchor.BN(makerAmount.toString()),
                new anchor.BN(takerAmount.toString()),
            )
            .accounts({
                //@ts-ignore
                trader: this.program.provider.publicKey,
                position: position,
            })
            .rpc();
    }

    async executeStopLossOrder({
        interest,
        executionFee,
        swapIn,
        swapOut,
    }: OrderArgs = defaultStopLossOrderArgs) {
        const instructions = await Promise.all([
            this.stopLossSetup({ interest, executionFee }),
            this.isLongTest ?
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
            this.stopLossCleanup(this.SWAP_AUTHORITY)
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        return await this.send(instructions, this.SWAP_AUTHORITY);
    }

    async stopLossSetup({
        interest,
        executionFee,
    }: {
        interest: bigint,
        executionFee: bigint,
    }) {
        const expiration = Date.now() / 1_000 + 60 * 60;
        const position = this.isLongTest ? this.longPosition : this.shortPosition;
        const pool = this.isLongTest ? this.longPool : this.shortPool;

        return await this.program.methods
            .stopLossSetup(
                new anchor.BN(0), // minTargetAmount
                new anchor.BN(interest.toString()),
                new anchor.BN(executionFee.toString()),
                new anchor.BN(expiration)
            )
            .accounts({
                closePositionSetup: {
                    owner: this.program.provider.publicKey,
                    position: position,
                    pool: pool,
                    collateral: this.collateral,
                    //@ts-ignore
                    authority: this.SWAP_AUTHORITY.publicKey,
                    permission: this.swapPermission,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            })
            .instruction();
    }

    async stopLossCleanup(signer: anchor.web3.Keypair) {
        const position = this.isLongTest ? this.longPosition : this.shortPosition;
        const pool = this.isLongTest ? this.longPool : this.shortPool;
        const stopLossOrder = this.isLongTest ? this.longStopLossOrder : this.shortStopLossOrder;

        return await this.program.methods.stopLossCleanup()
            .accounts({
                closePositionCleanup: {
                    //@ts-ignore
                    owner: this.program.provider.publicKey,
                    ownerPayoutAccount: this.ownerCurrencyAta,
                    position: position,
                    pool: pool,
                    currency: this.currency,
                    collateral: this.collateral,
                    authority: signer.publicKey,
                    lpVault: this.lpVault,
                    feeWallet: this.feeWallet,
                    liquidationWallet: this.liquidationWallet,
                    currencyTokenProgram: TOKEN_PROGRAM_ID,
                    collateralTokenProgram: TOKEN_PROGRAM_ID,
                },
                stopLossOrder: stopLossOrder,
            })
            .instruction();
    }

    async cancelStopLossOrder(signer?: anchor.web3.Keypair) {
        const position = this.isLongTest ? this.longPosition : this.shortPosition;
        const closer = this.useTrader ? this.program.provider.publicKey : this.SWAP_AUTHORITY.publicKey;

        const baseMethodCall = this.program.methods.closeStopLossOrder().accounts({
            closer,
            //@ts-ignore
            trader: this.program.provider.publicKey,
            permission: this.swapPermission,
            position: position,
        });

        if (signer) {
            return await baseMethodCall.signers([signer]).rpc();
        } else {
            return await baseMethodCall.rpc();
        }
    }
}
