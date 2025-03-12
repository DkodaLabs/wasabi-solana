import {PublicKey, Keypair} from '@solana/web3.js'
import {getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID} from '@solana/spl-token'
import {TestContext} from '../testContext';
import {superAdminProgram, WASABI_PROGRAM_ID} from "../hooks/rootHook";

export class PoolContext extends TestContext {
    longPool: PublicKey;
    shortPool: PublicKey;

    isLong = true;

    constructor(
        readonly INIT_AUTHORITY = Keypair.generate(),
        readonly NON_INIT_AUTHORITY = Keypair.generate(),
        readonly initPermission = PublicKey.findProgramAddressSync([
            Buffer.from('admin'),
            INIT_AUTHORITY.publicKey.toBuffer()
        ], WASABI_PROGRAM_ID)[0],
        readonly invalidPermission = PublicKey.findProgramAddressSync([
            Buffer.from('admin'),
            NON_INIT_AUTHORITY.publicKey.toBuffer(),
        ], WASABI_PROGRAM_ID)[0],
    ) {
        super();
    }

    async generate(): Promise<this> {
        await this._generate();

        this.longPool = PublicKey.findProgramAddressSync(
            [Buffer.from("long_pool"), this.collateral.toBuffer(), this.currency.toBuffer()],
            WASABI_PROGRAM_ID
        )[0];

        this.shortPool = PublicKey.findProgramAddressSync(
            [Buffer.from('short_pool'), this.collateral.toBuffer(), this.currency.toBuffer()],
            WASABI_PROGRAM_ID
        )[0];

        const initPermissionIx = await superAdminProgram.methods
            .initOrUpdatePermission({
                canCosignSwaps:      false, // 4
                canInitVaults:       false, // 1
                canLiquidate:        false, // 2
                canInitPools:        true, // 8
                canBorrowFromVaults: false,
                status:              {active: {}}
            })
            .accounts({
                payer:        superAdminProgram.provider.publicKey,
                newAuthority: this.INIT_AUTHORITY.publicKey,
            })
            .instruction();

        await superAdminProgram.methods
            .initOrUpdatePermission({
                canCosignSwaps:      true, // 4
                canInitVaults:       true, // 1
                canLiquidate:        true, // 2
                canInitPools:        false, // 8
                canBorrowFromVaults: true,
                status:              {active: {}}
            })
            .accounts({
                payer:        superAdminProgram.provider.publicKey,
                newAuthority: this.NON_INIT_AUTHORITY.publicKey,
            })
            .preInstructions([initPermissionIx])
            .rpc();

        return this;
    }

    get poolAccounts() {
        return {
            collateral:             this.collateral,
            currency:               this.currency,
            collateralTokenProgram: TOKEN_PROGRAM_ID,
            currencyTokenProgram:   TOKEN_PROGRAM_ID,
        };
    }

    getPoolAtas() {
        return this.isLong ? {
            currencyVault:   getAssociatedTokenAddressSync(
                this.currency,
                this.longPool,
                true,
                TOKEN_PROGRAM_ID
            ),
            collateralVault: getAssociatedTokenAddressSync(
                this.collateral,
                this.longPool,
                true,
                TOKEN_PROGRAM_ID
            ),
        } : {
            currencyVault:   getAssociatedTokenAddressSync(
                this.currency,
                this.shortPool,
                true,
                TOKEN_PROGRAM_ID
            ),
            collateralVault: getAssociatedTokenAddressSync(
                this.collateral,
                this.shortPool,
                true,
                TOKEN_PROGRAM_ID
            ),
        }
    }

    async initLongPool(signer: Keypair = this.INIT_AUTHORITY) {
        return await this.program.methods.initLongPool().accountsPartial({
            permission: this.initPermission,
            ...this.poolAccounts,
        }).signers([signer]).rpc()

    }

    async initShortPool(signer: Keypair = this.INIT_AUTHORITY) {
        return await this.program.methods.initShortPool().accountsPartial({
            permission: this.initPermission,
            ...this.poolAccounts,
        }).signers([signer]).rpc()
    }
}