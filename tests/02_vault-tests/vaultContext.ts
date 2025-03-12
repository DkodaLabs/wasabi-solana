import {TestContext} from "../testContext";
import {getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";

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
            .deposit(new anchor.BN(amount.toString()))
            .accountsPartial(this.getVaultAccounts())
            .rpc();
    }

    async withdraw(amount: bigint) {
        return await this.program.methods
            .withdraw(new anchor.BN(amount.toString()))
            .accountsPartial(this.getVaultAccounts())
            .rpc();
    };

    async donate(amount: bigint) {
        return await this.program.methods
            .donate(new anchor.BN(amount.toString()))
            .accountsPartial({
                owner:        this.program.provider.publicKey,
                permission:   anchor.web3.PublicKey.findProgramAddressSync(
                    [Buffer.from("admin"), this.program.provider.publicKey.toBuffer()],
                    this.program.programId
                )[0],
                currency:     this.currency,
                tokenProgram: TOKEN_PROGRAM_ID,
                ...this.getVaultAccounts()
            })
            .rpc();
    };

    getVaultAccounts() {
        return {
            owner:        this.program.provider.publicKey,
            lpVault:      this.lpVault,
            assetMint:    this.currency,
            tokenProgram: TOKEN_PROGRAM_ID,
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

    async getSharesMint() {
        return await this.program.account.lpVault.fetch(this.lpVault).then(v => v.sharesMint);
    }
}