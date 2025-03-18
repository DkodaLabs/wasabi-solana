import {assert} from 'chai';
import {BN} from "@coral-xyz/anchor";
import {defaultOpenLongPositionArgs, defaultOpenShortPositionArgs} from "../04_trade-tests/tradeContext";
import {EditPositionContext} from "./editPositionContext";
import {
    createAssociatedTokenAccountIdempotentInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";

export const increasePositionWithIncorrectUser = async (ctx: EditPositionContext) => {
    try {
        const [{minOut, downPayment, principal, fee}, position, pool, currencyVault, collateralVault] = ctx.isLongTest
            ? [
                defaultOpenLongPositionArgs,
                ctx.longPosition,
                ctx.longPool,
                ctx.longPoolCurrencyVault,
                ctx.longPoolCollateralVault
            ] : [
                defaultOpenShortPositionArgs,
                ctx.shortPosition,
                ctx.shortPool,
                ctx.shortPoolCurrencyVault,
                ctx.shortPoolCollateralVault
            ]
        const now = new Date().getTime() / 1_000;

        const ownerAtaIx = createAssociatedTokenAccountIdempotentInstruction(
            ctx.SWAP_AUTHORITY.publicKey,
            getAssociatedTokenAddressSync(
                ctx.currency,
                ctx.SWAP_AUTHORITY.publicKey,
                false,
                TOKEN_PROGRAM_ID
            ),
            ctx.SWAP_AUTHORITY.publicKey,
            ctx.currency,
            TOKEN_PROGRAM_ID
        );

        await ctx.program.methods.openLongPositionSetup(
            ctx.nonce,
            new BN(minOut.toString()),
            new BN(downPayment.toString()),
            new BN(principal.toString()),
            new BN(fee.toString()),
            new BN(now + 3600),
        ).accountsPartial({
            owner:        ctx.SWAP_AUTHORITY.publicKey, // Invalid user
            lpVault:      ctx.lpVault,
            position,
            pool,
            collateral:   ctx.collateral,
            currency:     ctx.currency,
            currencyVault,
            collateralVault,
            authority:    ctx.SWAP_AUTHORITY.publicKey,
            permission:   ctx.swapPermission,
            feeWallet:    ctx.feeWallet,
            tokenProgram: TOKEN_PROGRAM_ID,
        }).preInstructions([ownerAtaIx]).signers([ctx.SWAP_AUTHORITY]).rpc();

        assert.fail("Expected increase position to fail with constraint error");
    } catch (error) {
        if (/A seeds constraint was violated/.test(error.toString())) {
            assert.ok(true);
        } else {
            console.error(error);
            assert.ok(false);
        }
    }
};
