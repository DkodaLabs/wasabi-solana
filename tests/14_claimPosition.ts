import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";
import {
  abSwapKey,
  feeWalletA,
  globalSettingsKey,
  poolFeeAccount,
  poolMint,
  SWAP_AUTHORITY,
  swapTokenAccountA,
  swapTokenAccountB,
  tokenMintA,
  tokenMintB,
} from "./rootHooks";
import { TOKEN_SWAP_PROGRAM_ID, TokenSwap } from "@solana/spl-token-swap";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("ClaimPosition", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
  const [coSignerPermission] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("admin"),
      SWAP_AUTHORITY.publicKey.toBuffer(),
    ],
    program.programId,
  );
  const ownerTokenA = getAssociatedTokenAddressSync(
    tokenMintA,
    program.provider.publicKey,
    false,
  );
  const [lpVaultKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
    program.programId,
  );
  const [longPoolBKey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("long_pool"),
      tokenMintB.toBuffer(),
      tokenMintA.toBuffer(),
    ],
    program.programId,
  );
  const longPoolBVaultKey = getAssociatedTokenAddressSync(
    tokenMintB,
    longPoolBKey,
    true,
  );
  const longPoolBCurrencyVaultKey = getAssociatedTokenAddressSync(
    tokenMintA,
    longPoolBKey,
    true,
  );

  before(async () => {});

  describe("Short position", async () => {
    before(async () => {
      // TODO: Create a short position
    });
    it("should successfully pay loan and return collateral to user", async () => {
      // TODO: validate Position is closed
      // TODO: validate principal and interest was paid by the trader
      // TODO: validate the LP Vault received the interest and principal
      // TODO: Validate the Trader recevied the collateral.
      // TODO: Validate the Pool's collateral_vault paid the collateral.
    });
  });

  describe("Long position", async () => {
    let positionKey: anchor.web3.PublicKey;
    before(async () => {
      const nonce = 1;
      const fee = new anchor.BN(10);
      const now = new Date().getTime() / 1_000;
      const downPayment = new anchor.BN(1_000);
      // amount to be borrowed
      const principal = new anchor.BN(1_000);
      const swapAmount = downPayment.add(principal);
      const minimumAmountOut = new anchor.BN(1_900);
      [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("position"),
          program.provider.publicKey.toBuffer(),
          longPoolBKey.toBuffer(),
          lpVaultKey.toBuffer(),
          new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
        ],
        program.programId,
      );
      const setupIx = await program.methods
        .openLongPositionSetup({
          nonce,
          minTargetAmount: minimumAmountOut,
          downPayment,
          principal,
          currency: tokenMintA,
          expiration: new anchor.BN(now + 3_600),
          fee,
        })
        .accounts({
          owner: program.provider.publicKey,
          ownerCurrencyAccount: ownerTokenA,
          // @ts-ignore 
          currencyVault: longPoolBCurrencyVaultKey,
          lpVault: lpVaultKey,
          longPool: longPoolBKey,
          permission: coSignerPermission,
          authority: SWAP_AUTHORITY.publicKey,
          feeWallet: feeWalletA,
          globalSettings: globalSettingsKey,
        })
        .instruction();
      const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
        [abSwapKey.publicKey.toBuffer()],
        TOKEN_SWAP_PROGRAM_ID,
      );
      const swapIx = TokenSwap.swapInstruction(
        abSwapKey.publicKey,
        swapAuthority,
        SWAP_AUTHORITY.publicKey,
        longPoolBCurrencyVaultKey,
        swapTokenAccountA,
        swapTokenAccountB,
        longPoolBVaultKey,
        poolMint,
        poolFeeAccount,
        null,
        tokenMintA,
        tokenMintB,
        TOKEN_SWAP_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        BigInt(swapAmount.toString()),
        BigInt(minimumAmountOut.toString()),
      );
      await program.methods
        .openLongPositionCleanup()
        .accounts({
          owner: program.provider.publicKey,
          longPool: longPoolBKey,
          position: positionKey,
        })
        .preInstructions([setupIx, swapIx])
        .signers([SWAP_AUTHORITY])
        .rpc({ skipPreflight: true });
    });
    it("should successfully pay loan and return collateral to user", async () => {
      const positionBefore = await program.account.position.fetch(positionKey);

      assert.ok(positionBefore.trader.equals(program.provider.publicKey));
      // TODO: validate Position is closed
      // TODO: validate principal and interest was paid by the trader
      // TODO: validate the LP Vault received the interest and principal
      // TODO: Validate the Trader recevied the collateral.
      // TODO: Validate the Pool's collateral_vault paid the collateral.
      assert.ok(false);
    });
  });
});
