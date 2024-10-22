import {
    AnchorProvider,
    Program,
    Wallet,
    BN,
    web3,
    utils
} from "@coral-xyz/anchor";
import {
    PublicKey,
    Connection,
} from "@solana/web3.js";
import { WasabiSolana } from "../../idl/wasabi_solana";
import * as IDL from "../../idl/wasabi_solana.json";

const idl: WasabiSolana = IDL as WasabiSolana;

export class WasabiClient {
    private program: Program<WasabiSolana>;

    constructor(connection: Connection, wallet: Wallet) {
        const provider = new AnchorProvider(
            connection,
            wallet,
            {
                preflightCommitment: "confirmed",
                commitment: "confirmed",
            }
        );
        this.program = new Program(idl, provider);
    }
}
