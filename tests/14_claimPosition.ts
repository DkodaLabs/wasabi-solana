import * as anchor from "@coral-xyz/anchor";
import { WasabiSolana } from "../target/types/wasabi_solana";
import { assert } from "chai";

describe("ClaimPosition", () => {
  const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;

  before(async () => {});

  describe("Short position", async () => {
    before(async () => {
      // TODO: Create a short position
    })
    it("should successfully pay loan and return collateral to user", async () => {    
      // TODO: validate Position is closed
      // TODO: validate principal and interest was paid by the trader
      // TODO: validate the LP Vault received the interest and principal
      // TODO: Validate the Trader recevied the collateral. 
      // TODO: Validate the Pool's collateral_vault paid the collateral. 
    });
  });

  describe("Long position", async () => {
    before(async () => {
      // TODO: Create a long position
    })
    it("should successfully pay loan and return collateral to user", async () => {    
      // TODO: validate Position is closed
      // TODO: validate principal and interest was paid by the trader
      // TODO: validate the LP Vault received the interest and principal
      // TODO: Validate the Trader recevied the collateral. 
      // TODO: Validate the Pool's collateral_vault paid the collateral. 
    });
  });

});
