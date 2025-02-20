import * as anchor from "@coral-xyz/anchor";
import { AccountLayout } from "@solana/spl-token";
import { assert } from "chai";
import {
    accountStates,
    strategyDeposit,
} from "../hooks/strategyHook";

describe("StrategyDeposit", () => {
    describe("correct setup with an equal amount sent and received", () => {
        it("should deposit into the strategy", async () => {
            const statesBefore = await accountStates();

            try {
                const [sendAmount, receiveAmount] = [1000, 1000];

                await strategyDeposit({ amountIn: sendAmount, amountOut: receiveAmount });

                const statesAfter = await accountStates();

                const vaultBeforeData = AccountLayout.decode(statesBefore.vault.data);
                const vaultAfterData = AccountLayout.decode(statesAfter.vault.data);

                const collateralVaultBalanceBefore =
                    AccountLayout.decode(statesBefore.collateralVault.data).amount;
                const collateralVaultBalanceAfter =
                    AccountLayout.decode(statesAfter.collateralVault.data).amount;

                assert.equal(
                    statesAfter.lpVault.totalBorrowed.toNumber(),
                    (statesBefore.lpVault.totalBorrowed.add(new anchor.BN(sendAmount)).toNumber())
                );

                assert.equal(
                    statesAfter.strategy.totalBorrowedAmount.toNumber(),
                    (statesBefore.strategy.totalBorrowedAmount.add(new anchor.BN(sendAmount)).toNumber())
                );

                assert.equal(
                    Number(vaultAfterData.amount),
                    Number(vaultBeforeData.amount - BigInt(sendAmount))
                );

                assert.equal(
                    Number(collateralVaultBalanceAfter),
                    Number(collateralVaultBalanceBefore + BigInt(receiveAmount))
                );
            } catch (err) {
                console.error(err);
                assert.ok(false);
            }
        })
    });
    describe("a second is made", () => {
        it("should correctly increment the borrowed values of the strategy and lp vault", async () => {
        });
    });
});
