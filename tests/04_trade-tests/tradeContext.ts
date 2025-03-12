import * as anchor from '@coral-xyz/anchor';
import {Keypair, LAMPORTS_PER_SOL, PublicKey, TransactionInstruction} from '@solana/web3.js';
import {TestContext} from '../testContext';
import {WASABI_PROGRAM_ID} from "../hooks/rootHook";
import {
    createBurnCheckedInstruction,
    createMintToInstruction,
    createAssociatedTokenAccountIdempotentInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";

export interface OpenPositionArgs {
    minOut: bigint;
    downPayment: bigint;
    principal: bigint; // maxIn
    fee: bigint;
    swapIn?: bigint;
    swapOut?: bigint;
}

export interface ClosePositionArgs {
    minOut: bigint;
    interest: bigint;
    executionFee: bigint;
    swapIn?: bigint;
    swapOut?: bigint;
}

export interface SwapArgs {
    swapIn: bigint;
    swapOut: bigint;
    poolAtaA: PublicKey;
    poolAtaB: PublicKey;
}

export const defaultOpenLongPositionArgs = <OpenPositionArgs>{
    minOut:      BigInt(1_900),
    downPayment: BigInt(1_000),
    principal:   BigInt(1_000),
    fee:         BigInt(10),
    swapIn:      BigInt(2_000),
    swapOut:     BigInt(1_900),
};

export const defaultOpenShortPositionArgs = <OpenPositionArgs>{
    minOut:      BigInt(1),
    downPayment: BigInt(1_000),
    principal:   BigInt(1_000),
    fee:         BigInt(10),
    swapIn:      BigInt(1_000),
    swapOut:     BigInt(1),
};

export const defaultCloseLongPositionArgs = <ClosePositionArgs>{
    minOut:       BigInt(0),
    interest:     BigInt(1),
    executionFee: BigInt(11),
    expiration:   BigInt(Date.now() / 1_000 + 60 * 60),
    swapIn:       BigInt(1_900),
    swapOut:      BigInt(2_000),
};

export const defaultCloseShortPositionArgs = <ClosePositionArgs>{
    minOut:       BigInt(0),
    interest:     BigInt(1),
    executionFee: BigInt(10),
};

export class TradeContext extends TestContext {
    nonce = 69;
    feeWallet: PublicKey;
    liquidationWallet: PublicKey;
    longPool: PublicKey;
    longPoolCurrencyVault: PublicKey;
    longPoolCollateralVault: PublicKey;
    shortPool: PublicKey;
    shortPoolCurrencyVault: PublicKey;
    shortPoolCollateralVault: PublicKey;
    openPositionListener: number;
    closePositionListener: number;
    openPositionEvent;
    closePositionEvent;

    longPosition: PublicKey;
    shortPosition: PublicKey;
    openPositionRequest: PublicKey;

    constructor(
        readonly SWAP_AUTHORITY = Keypair.generate(),
        readonly NON_SWAP_AUTHORITY = Keypair.generate(),
        readonly swapPermission = PublicKey.findProgramAddressSync([
            anchor.utils.bytes.utf8.encode('admin'),
            SWAP_AUTHORITY.publicKey.toBuffer(),
        ], WASABI_PROGRAM_ID)[0],
        readonly invalidPermission = PublicKey.findProgramAddressSync([
            anchor.utils.bytes.utf8.encode('admin'),
            NON_SWAP_AUTHORITY.publicKey.toBuffer(),
        ], WASABI_PROGRAM_ID)[0],
    ) {
        super();
    }

    isLongTest = true;
    isCloseTest = false;
    withOtherSidePool = false

    async generateLongTest(): Promise<this> {
        this.isLongTest = true;
        this.withOtherSidePool = false;
        await this.generate();
        return this;
    }

    async generateLongTestWithShortPool(): Promise<this> {
        this.isLongTest = true;
        this.withOtherSidePool = true;
        await this.generate();
        return this;
    }

    async generateLongTestWithDefaultPosition(): Promise<this> {
        await Promise.all([
            this.generateLongTest(),
            this.openLongPosition()
        ]);

        return this;
    }

    async generateShortTest(): Promise<this> {
        this.isLongTest = false;
        this.withOtherSidePool = false;
        await this.generate();
        return this;
    }

    async generateShortTestWithLongPool(): Promise<this> {
        this.isLongTest = false;
        this.withOtherSidePool = true;
        await this.generate();
        return this;
    }

    async generateShortTestWithDefaultPosition(): Promise<this> {
        await Promise.all([
            this.generateShortTest(),
            this.openShortPosition()
        ]);
        return this;
    }

    async generate(): Promise<this> {
        await super._generate();

        this.feeWallet = getAssociatedTokenAddressSync(
            this.currency,
            this.program.provider.publicKey,
            false,
            TOKEN_PROGRAM_ID
        );
        this.liquidationWallet = getAssociatedTokenAddressSync(
            this.currency,
            this.program.provider.publicKey,
            false,
            TOKEN_PROGRAM_ID
        );

        this.openPositionRequest = PublicKey.findProgramAddressSync([
            anchor.utils.bytes.utf8.encode('open_pos'),
            this.program.provider.publicKey.toBuffer(),
        ], WASABI_PROGRAM_ID)[0];

        if (this.isLongTest) {
            this.longPool = PublicKey.findProgramAddressSync(
                [Buffer.from('long_pool'), this.collateral.toBuffer(), this.currency.toBuffer()],
                WASABI_PROGRAM_ID
            )[0];

            this.longPoolCurrencyVault =
                getAssociatedTokenAddressSync(this.currency, this.longPool, true, TOKEN_PROGRAM_ID);
            this.longPoolCollateralVault =
                getAssociatedTokenAddressSync(this.collateral, this.longPool, true, TOKEN_PROGRAM_ID);

            this.longPosition = PublicKey.findProgramAddressSync([
                Buffer.from('position'),
                this.program.provider.publicKey.toBuffer(),
                this.longPool.toBuffer(),
                this.lpVault.toBuffer(),
                new anchor.BN(this.nonce).toArrayLike(Buffer, "le", 2),
            ], WASABI_PROGRAM_ID)[0];
        } else {
            this.shortPool = PublicKey.findProgramAddressSync(
                [Buffer.from('short_pool'), this.collateral.toBuffer(), this.currency.toBuffer()],
                WASABI_PROGRAM_ID
            )[0];

            this.shortPoolCurrencyVault =
                getAssociatedTokenAddressSync(this.currency, this.shortPool, true, TOKEN_PROGRAM_ID);
            this.shortPoolCollateralVault =
                getAssociatedTokenAddressSync(this.collateral, this.shortPool, true, TOKEN_PROGRAM_ID);

            this.shortPosition = PublicKey.findProgramAddressSync([
                Buffer.from('position'),
                this.program.provider.publicKey.toBuffer(),
                this.shortPool.toBuffer(),
                this.lpVault.toBuffer(),
                new anchor.BN(this.nonce).toArrayLike(Buffer, "le", 2),
            ], WASABI_PROGRAM_ID)[0];
        }

        if (this.isCloseTest) {
            this.closePositionListener = this.program.addEventListener('positionClosed', (event) => {
                this.closePositionEvent = event
            });
        } else {
            this.openPositionListener = this.program.addEventListener('positionOpened', (event) => {
                this.openPositionEvent = event
            });
        }

        const [sharesMint] = PublicKey.findProgramAddressSync(
            [this.lpVault.toBuffer(), this.currency.toBuffer()], WASABI_PROGRAM_ID
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

        await this.program.methods
            .deposit(new anchor.BN(5_000 * LAMPORTS_PER_SOL))
            .accountsPartial({
                owner:             this.program.provider.publicKey,
                lpVault:           this.lpVault,
                assetMint:         this.currency,
                assetTokenProgram: TOKEN_PROGRAM_ID
            })
            .preInstructions([createOwnerSharesAccount])
            .rpc();

        return this;
    }

    async send(instructions: TransactionInstruction[], signer: Keypair = this.SWAP_AUTHORITY) {
        const connection = this.program.provider.connection;
        const message = new anchor.web3.TransactionMessage({
            instructions,
            payerKey:        this.program.provider.publicKey!,
            recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        }).compileToV0Message([]);

        const tx = new anchor.web3.VersionedTransaction(message);

        return await this.program.provider.sendAndConfirm(tx, [signer], {
            skipPreflight: false, // NEVER `skipPreflight=true` during testing
        });
    };

    async sendInvalid(instructions: TransactionInstruction[]) {
        return await this.send(instructions, this.NON_SWAP_AUTHORITY);
    }

    async createABSwapIx({
        swapIn,
        swapOut,
        poolAtaA,
        poolAtaB,
    }: SwapArgs) {
        return await Promise.all([
            createBurnCheckedInstruction(
                poolAtaA,
                this.currency,
                this.SWAP_AUTHORITY.publicKey,
                swapIn,
                6,
            ),

            createMintToInstruction(
                this.collateral,
                poolAtaB,
                this.program.provider.publicKey,
                swapOut,
            )
        ]);
    }

    async createBASwapIx({
        swapIn,
        swapOut,
        poolAtaA,
        poolAtaB,
    }: SwapArgs) {
        return await Promise.all([
            createBurnCheckedInstruction(
                poolAtaB,
                this.collateral,
                this.SWAP_AUTHORITY.publicKey,
                swapIn,
                6,
            ),

            createMintToInstruction(
                this.currency,
                poolAtaA,
                this.program.provider.publicKey,
                swapOut,
            )
        ]);
    }

    async openLongPosition({
        minOut,
        downPayment,
        principal,
        fee,
        swapIn,
        swapOut,
    }: OpenPositionArgs = defaultOpenLongPositionArgs) {
        const instructions = await Promise.all([
            this.openLongPositionSetup({
                minOut,
                downPayment,
                principal,
                fee,
            }),

            this.createABSwapIx({
                swapIn,
                swapOut,
                poolAtaA: this.longPoolCurrencyVault,
                poolAtaB: this.longPoolCollateralVault
            }),

            this.openLongPositionCleanup(),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        console.log(JSON.stringify(instructions));

        return await this.send(instructions);
    }

    async openShortPosition({
        minOut,
        downPayment,
        principal,
        fee,
        swapIn,
        swapOut,
    }: OpenPositionArgs = defaultOpenShortPositionArgs) {
        const instructions = await Promise.all([
            this.openShortPositionSetup({
                minOut,
                downPayment,
                principal,
                fee,
            }),

            this.createABSwapIx({
                swapIn,
                swapOut,
                poolAtaA: this.shortPoolCurrencyVault,
                poolAtaB: this.shortPoolCollateralVault,
            }),

            this.openShortPositionCleanup(),
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        console.log(JSON.stringify(instructions));

        return await this.send(instructions);
    }

    async closeLongPosition({
        minOut,
        interest,
        executionFee,
        swapIn,
        swapOut,
    }: ClosePositionArgs = defaultCloseLongPositionArgs) {
        const instructions = await Promise.all([
            this.closeLongPositionSetup({minOut, interest, executionFee}),
            this.createBASwapIx({
                swapIn,
                swapOut,
                poolAtaA: this.longPoolCurrencyVault,
                poolAtaB: this.longPoolCollateralVault
            }),
            this.closeLongPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        return await this.send(instructions);
    };

    async closeShortPosition({
        minOut,
        interest,
        executionFee,
        swapIn,
        swapOut,
    }: ClosePositionArgs = defaultCloseShortPositionArgs) {
        const instructions = await Promise.all([
            this.closeShortPositionSetup({minOut, interest, executionFee}),
            this.createABSwapIx({
                swapIn,
                swapOut,
                poolAtaA: this.shortPoolCurrencyVault,
                poolAtaB: this.shortPoolCollateralVault
            }),
            this.closeShortPositionCleanup()
        ]).then(ixes => ixes.flatMap((ix: TransactionInstruction) => ix));

        return await this.send(instructions);
    };

    async openLongPositionSetup({
        minOut,
        downPayment,
        principal,
        fee,
    }: OpenPositionArgs = defaultOpenLongPositionArgs) {
        const now = new Date().getTime() / 1_000;

        return await this.program.methods.openLongPositionSetup(
            this.nonce,
            new anchor.BN(minOut.toString()),
            new anchor.BN(downPayment.toString()),
            new anchor.BN(principal.toString()),
            new anchor.BN(fee.toString()),
            new anchor.BN(now + 3600),
        ).accountsPartial({
            owner:        this.program.provider.publicKey,
            lpVault:      this.lpVault,
            pool:         this.longPool,
            collateral:   this.collateral,
            currency:     this.currency,
            authority:    this.SWAP_AUTHORITY.publicKey,
            permission:   this.swapPermission,
            feeWallet:    this.feeWallet,
            tokenProgram: TOKEN_PROGRAM_ID,
        }).instruction();
    };

    async openLongPositionCleanup() {
        return this.program.methods
            .openLongPositionCleanup()
            .accountsPartial({
                owner:        this.program.provider.publicKey,
                pool:         this.longPool,
                position:     this.longPosition,
                tokenProgram: TOKEN_PROGRAM_ID,
            }).instruction();
    };

    async openShortPositionSetup({
        minOut,
        downPayment,
        principal,
        fee,
    }: OpenPositionArgs = defaultOpenShortPositionArgs) {
        const now = new Date().getTime() / 1_000;

        return await this.program.methods.openShortPositionSetup(
            this.nonce,
            new anchor.BN(minOut.toString()),
            new anchor.BN(downPayment.toString()),
            new anchor.BN(principal.toString()),
            new anchor.BN(fee.toString()),
            new anchor.BN(now + 3600),
        ).accountsPartial({
            owner:                  this.program.provider.publicKey,
            lpVault:                this.lpVault,
            pool:                   this.shortPool,
            collateral:             this.collateral,
            currency:               this.currency,
            authority:              this.SWAP_AUTHORITY.publicKey,
            permission:             this.swapPermission,
            feeWallet:              this.feeWallet,
            currencyTokenProgram:   TOKEN_PROGRAM_ID,
            collateralTokenProgram: TOKEN_PROGRAM_ID,
        }).instruction();
    };

    async openShortPositionCleanup() {
        return this.program.methods
            .openShortPositionCleanup()
            .accountsPartial({
                owner:        this.program.provider.publicKey,
                pool:         this.shortPool,
                position:     this.shortPosition,
                tokenProgram: TOKEN_PROGRAM_ID,
            }).instruction();
    };

    async closeLongPositionSetup({
        minOut,
        interest,
        executionFee,
    }: ClosePositionArgs = defaultCloseLongPositionArgs) {
        const expiration = Date.now() / 1_000 + 60 * 60;

        return await this.program.methods
            .closeLongPositionSetup(
                new anchor.BN(minOut.toString()),
                new anchor.BN(interest.toString()),
                new anchor.BN(executionFee.toString()),
                new anchor.BN(expiration)
            ).accountsPartial({
                owner:              this.program.provider.publicKey,
                closePositionSetup: {
                    pool:         this.longPool,
                    owner:        this.program.provider.publicKey,
                    collateral:   this.collateral,
                    position:     this.longPosition,
                    permission:   this.swapPermission,
                    authority:    this.SWAP_AUTHORITY.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            }).instruction();
    };

    async closeLongPositionCleanup() {
        return await this.program.methods.closeLongPositionCleanup().accountsPartial({
            owner: this.program.provider.publicKey,
            //@ts-ignore
            ownerPayoutAccount:     ownerTokenA,
            pool:                   this.longPool,
            position:               this.longPosition,
            currency:               this.currency,
            collateral:             this.collateral,
            authority:              this.SWAP_AUTHORITY.publicKey,
            feeWallet:              this.feeWallet,
            liquidationWallet:      this.liquidationWallet,
            collateralTokenProgram: TOKEN_PROGRAM_ID,
            currencyTokenProgram:   TOKEN_PROGRAM_ID,
        }).instruction();
    };

    async closeShortPositionSetup({
        minOut,
        interest,
        executionFee,
    }: ClosePositionArgs = defaultCloseShortPositionArgs) {
        return await this.program.methods.closeShortPositionSetup(
            new anchor.BN(minOut.toString()),
            new anchor.BN(interest.toString()),
            new anchor.BN(executionFee.toString()),
            new anchor.BN(Date.now() / 1_000 + 60 * 60),
        ).accountsPartial({
            owner:              this.program.provider.publicKey,
            closePositionSetup: {
                owner:        this.program.provider.publicKey,
                position:     this.shortPosition,
                pool:         this.shortPool,
                collateral:   this.collateral,
                authority:    this.SWAP_AUTHORITY.publicKey,
                permission:   this.swapPermission,
                tokenProgram: TOKEN_PROGRAM_ID,
            }
        }).instruction();
    };

    async closeShortPositionCleanup() {
        return await this.program.methods.closeShortPositionCleanup().accountsPartial({
            owner: this.program.provider.publicKey,
            //@ts-ignore
            collateral:             this.collateral,
            collateralTokenProgram: TOKEN_PROGRAM_ID,
            closePositionCleanup:   {
                owner:                  this.program.provider.publicKey,
                ownerPayoutAccount:     this.ownerCurrencyAta,
                pool:                   this.shortPool,
                collateral:             this.collateral,
                currency:               this.currency,
                position:               this.shortPosition,
                authority:              this.SWAP_AUTHORITY.publicKey,
                feeWallet:              this.feeWallet,
                liquidationWallet:      this.liquidationWallet,
                collateralTokenProgram: TOKEN_PROGRAM_ID,
                currencyTokenProgram:   TOKEN_PROGRAM_ID,
            }
        }).instruction();
    };
}
