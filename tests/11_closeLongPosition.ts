import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import { WasabiSolana } from "../target/types/wasabi_solana";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  abSwapKey,
  NON_SWAP_AUTHORITY,
  poolFeeAccount,
  poolMint,
  superAdminProgram,
  SWAP_AUTHORITY,
  swapTokenAccountA,
  swapTokenAccountB,
  TOKEN_SWAP_PROGRAM_ID,
  tokenMintA,
  tokenMintB,
} from "./rootHooks";
import { getMultipleTokenAccounts } from "./utils";
import { TokenSwap } from "@solana/spl-token-swap";

describe("CloseLongPosition", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  const [coSignerPermission] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("admin"),
      SWAP_AUTHORITY.publicKey.toBuffer(),
    ],
    program.programId,
  );
  const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
    program.programId,
  );
  const ownerTokenA = getAssociatedTokenAddressSync(
    tokenMintA,
    program.provider.publicKey,
    false,
  );
  const [longPoolBKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("long_pool"), tokenMintB.toBuffer()],
    program.programId,
  );
  const longPoolBVaultKey = getAssociatedTokenAddressSync(
    tokenMintB,
    longPoolBKey,
    true,
  );

  describe("With owned long position", () => {
    let positionKey: anchor.web3.PublicKey;
    before(async () => {
      const nonce = 0;
      [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("position"),
          program.provider.publicKey.toBuffer(),
          longPoolBKey.toBuffer(),
          lpVaultKey.toBuffer(),
          new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
        ],
        program.programId
      );
    });
    it("should close the position and return funds", async () => {
      const position = await program.account.position.fetch(positionKey);
      
    });
  });
});
