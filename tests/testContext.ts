import { SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js';
import { workspace, Program, web3 } from '@coral-xyz/anchor';
import { WasabiSolana } from '../target/types/wasabi_solana';
import { createAssociatedTokenAccountIdempotentInstruction, createMintToCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { createSimpleMint, initDefaultPermission, defaultInitLpVaultArgs } from './utils';
import { WASABI_PROGRAM_ID } from './hooks/rootHook';
import { MPL_TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import { superAdminProgram, superAdminPermission } from './hooks/rootHook';

export class TestContext {
    constructor(
        readonly program = workspace.WasabiSolana as Program<WasabiSolana>,
        readonly currencyKeypair = web3.Keypair.generate(),
        readonly collateralKeypair = web3.Keypair.generate(),
        readonly currency = currencyKeypair.publicKey,
        readonly collateral = collateralKeypair.publicKey,
        readonly defaultAuthority = web3.Keypair.generate(),
        readonly lpVault = web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("lp_vault"),
                currency.toBuffer()
            ],
            WASABI_PROGRAM_ID
        )[0],
        readonly vault = getAssociatedTokenAddressSync(
            currency,
            lpVault,
            true,
            TOKEN_PROGRAM_ID,
        ),
        readonly ownerCurrencyAta = getAssociatedTokenAddressSync(
            currency,
            program.provider.publicKey,
            false,
            TOKEN_PROGRAM_ID,
        ),

        readonly ownerCollateralAta = getAssociatedTokenAddressSync(
            collateral,
            program.provider.publicKey,
            false,
            TOKEN_PROGRAM_ID,
        ),
    ) { }

    protected async _generate() {
        const mintTx = new web3.Transaction();
        let [
            { ixes: uIxes, mint: uMint },
            { ixes: qIxes, mint: qMint }
        ] = await Promise.all([
            createSimpleMint(
                this.program.provider.publicKey,
                this.program.provider.connection,
                6,
                TOKEN_PROGRAM_ID,
                this.currencyKeypair
            ),
            createSimpleMint(
                this.program.provider.publicKey,
                this.program.provider.connection,
                6,
                TOKEN_PROGRAM_ID,
                this.collateralKeypair
            ),
        ]);

        mintTx.add(...uIxes, ...qIxes);
        await this.program.provider.sendAndConfirm(mintTx, [uMint, qMint]);

        const mintToTx = new web3.Transaction();

        const ownerCurrencyAtaIx = createAssociatedTokenAccountIdempotentInstruction(
            this.program.provider.publicKey,
            this.ownerCurrencyAta,
            this.program.provider.publicKey,
            this.currency,
            TOKEN_PROGRAM_ID,
        );

        const ownerCollateralAtaIx = createAssociatedTokenAccountIdempotentInstruction(
            this.program.provider.publicKey,
            this.ownerCollateralAta,
            this.program.provider.publicKey,
            this.collateral,
            TOKEN_PROGRAM_ID,
        );

        const mintCurrencyToOwner = createMintToCheckedInstruction(
            this.currency,
            this.ownerCurrencyAta,
            this.program.provider.publicKey,
            1_000_000_000 * Math.pow(10, 6),
            6,
            [],
            TOKEN_PROGRAM_ID,
        )

        const mintCollateralToOwner = createMintToCheckedInstruction(
            this.collateral,
            this.ownerCollateralAta,
            this.program.provider.publicKey,
            1_000_000_000 * Math.pow(10, 6),
            6,
            [],
            TOKEN_PROGRAM_ID,
        );

        mintToTx.add(
            ownerCurrencyAtaIx,
            ownerCollateralAtaIx,
            mintCurrencyToOwner,
            mintCollateralToOwner
        );

        await this.program.provider.sendAndConfirm(mintToTx);

        const permissionIx = await initDefaultPermission(this.defaultAuthority.publicKey);

        const vaultIx = createAssociatedTokenAccountIdempotentInstruction(
            superAdminProgram.provider.publicKey,
            this.vault,
            this.lpVault,
            this.currency,
            TOKEN_PROGRAM_ID
        );

        return await superAdminProgram.methods
            .initLpVault(defaultInitLpVaultArgs)
            .accountsPartial({
                payer: superAdminProgram.provider.publicKey,
                authority: superAdminProgram.provider.publicKey,
                vault: this.vault,
                lpVault: this.lpVault,
                permission: superAdminPermission,
                assetMint: this.currency,
                assetTokenProgram: TOKEN_PROGRAM_ID,
                tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
                sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
            })
            .preInstructions([permissionIx, vaultIx])
            .rpc();
    }
}
