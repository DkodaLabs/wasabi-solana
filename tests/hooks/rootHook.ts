import {AnchorProvider, Program, Wallet, web3, workspace} from "@coral-xyz/anchor";
import {WasabiSolana} from "../../target/types/wasabi_solana";
import {createSimpleMint} from "./../utils";
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";

export const WASABI_PROGRAM_ID = new web3.PublicKey("spicyTHtbmarmUxwFSHYpA8G4uP2nRNq38RReMpoZ9c");

export let superAdminProgram: Program<WasabiSolana>;
export const [superAdminPermission] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("super_admin")],
    WASABI_PROGRAM_ID
)

export const DEFAULT_AUTHORITY = web3.Keypair.generate();
export const feeWalletKeypair = web3.Keypair.generate();
export const liquidationWalletKeypair = web3.Keypair.generate();

export const mochaHooks = {
    beforeAll: async () => setupTestEnvironment(),
};

export const setupTestEnvironment = async () => {
    const program = workspace.WasabiSolana as Program<WasabiSolana>;

    superAdminProgram = new Program(
        program.idl,
        new AnchorProvider(
            AnchorProvider.local().connection,
            new Wallet(web3.Keypair.generate()),
            {commitment: "processed"}
        )
    );

    await Promise.all([
        superAdminProgram.provider.connection.requestAirdrop(
            superAdminProgram.provider.publicKey!,
            200_000_000_000
        ),
        superAdminProgram.provider.connection.requestAirdrop(
            DEFAULT_AUTHORITY.publicKey,
            200_000_000_000
        ),
        superAdminProgram.provider.connection.requestAirdrop(
            program.provider.publicKey,
            200_000_000_000
        ),
    ]);

    // This transaction isn't really used for anything
    // However, running the hook without this transaction results
    // in 0 balances from the airdrop for whatever reason
    const tx = new web3.Transaction();
    let {ixes: uIxes, mint: uMint} = await createSimpleMint(
        program.provider.publicKey,
        program.provider.connection,
        6,
        TOKEN_PROGRAM_ID,
        web3.Keypair.generate()
    );
    let {ixes: qIxes, mint: qMint} = await createSimpleMint(
        program.provider.publicKey,
        program.provider.connection,
        6,
        TOKEN_PROGRAM_ID,
        web3.Keypair.generate()
    );
    tx.add(...uIxes, ...qIxes);
    await program.provider.sendAndConfirm(tx, [uMint, qMint]);
};
