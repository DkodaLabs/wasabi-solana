import { TestContext } from "../testContext";
import {
    createAssociatedTokenAccountIdempotentInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { BN, web3 } from "@coral-xyz/anchor";
import { superAdminProgram } from "../hooks/rootHook";

export class VaultContext extends TestContext {
    constructor() {
        super(); // initializes the lp vault
    }

    async generate() {
        await this._generate();
        return this;
    }

    async deposit(amount: bigint) {
        return await this.program.methods
            .deposit(new BN(amount.toString()))
            .accountsPartial(this.getVaultAccounts())
            .rpc();
    }

    async withdraw(amount: bigint) {
        return await this.program.methods
            .withdraw(new BN(amount.toString()))
            .accountsPartial(this.getVaultAccounts())
            .rpc();
    };

    async donate(amount: bigint) {
        const permission = web3.PublicKey.findProgramAddressSync(
            [Buffer.from("admin"), this.program.provider.publicKey.toBuffer()],
            this.program.programId
        )[0];

        await superAdminProgram.methods.initOrUpdatePermission({
            canCosignSwaps: false, // 4
            canInitVaults: false, // 1
            canLiquidate: false, // 2
            canBorrowFromVaults: false, // 8
            canInitPools: false,
            status: { active: {} }
        })
            .accounts({
                payer: superAdminProgram.provider.publicKey,
                newAuthority: this.program.provider.publicKey,
            }).rpc();

        return await this.program.methods
            .donate(new BN(amount.toString()))
            .accountsPartial({
                owner: this.program.provider.publicKey,
                permission,
                currency: this.currency,
                tokenProgram: TOKEN_PROGRAM_ID,
                ...this.getVaultAccounts()
            })
            .rpc();
    };

    getVaultAccounts() {
        const ownerAssetAccount = getAssociatedTokenAddressSync(
            this.currency,
            this.program.provider.publicKey,
            false,
            TOKEN_PROGRAM_ID
        );

        return {
            owner: this.program.provider.publicKey,
            ownerAssetAccount,
            lpVault: this.lpVault,
            assetMint: this.currency,
            assetTokenProgram: TOKEN_PROGRAM_ID,
        }
    }

    async getUserSharesAta() {
        return getAssociatedTokenAddressSync(
            await this.getSharesMint(),
            this.program.provider.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID,
        );
    }

    async getUserSharesAtaIx() {
        return createAssociatedTokenAccountIdempotentInstruction(
            this.program.provider.publicKey,
            await this.getUserSharesAta(),
            this.program.provider.publicKey,
            await this.getSharesMint(),
            TOKEN_2022_PROGRAM_ID,
        )
    }

    async getSharesMint() {
        return await this.program.account.lpVault.fetch(this.lpVault).then(v => v.sharesMint);
    }
}
