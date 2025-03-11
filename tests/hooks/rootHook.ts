import {
    AnchorProvider,
    Program,
    Wallet,
    web3,
    workspace,
} from "@coral-xyz/anchor";
import {WasabiSolana} from "../../target/types/wasabi_solana";

export const WASABI_PROGRAM_ID = new web3.PublicKey("spicyTHtbmarmUxwFSHYpA8G4uP2nRNq38RReMpoZ9c");

export let superAdminProgram: Program<WasabiSolana>;
export const [superAdminPermission] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("super_admin")],
    WASABI_PROGRAM_ID
)

export const SWAP_AUTHORITY = web3.Keypair.generate();
/** Can liquidate AND init vaults */
export const NON_SWAP_AUTHORITY = web3.Keypair.generate();
export const NON_BORROW_AUTHORITY = web3.Keypair.generate();
export const BORROW_AUTHORITY = web3.Keypair.generate();
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
            100_000_000_000
        ),
        superAdminProgram.provider.connection.requestAirdrop(
            SWAP_AUTHORITY.publicKey,
            100_000_000_000
        ),
        superAdminProgram.provider.connection.requestAirdrop(
            NON_SWAP_AUTHORITY.publicKey,
            100_000_000_000
        ),
        superAdminProgram.provider.connection.requestAirdrop(
            NON_BORROW_AUTHORITY.publicKey,
            100_000_000_000
        ),
        superAdminProgram.provider.connection.requestAirdrop(
            BORROW_AUTHORITY.publicKey,
            100_000_000_000
        )
    ]);
};
