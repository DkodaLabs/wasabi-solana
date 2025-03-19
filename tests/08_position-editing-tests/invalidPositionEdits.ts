import {assert} from 'chai';
import {BN} from "@coral-xyz/anchor";
import {
    defaultCloseLongPositionArgs, defaultCloseShortPositionArgs,
    defaultOpenLongPositionArgs,
    defaultOpenShortPositionArgs
} from "../04_trade-tests/tradeContext";
import {EditPositionContext} from "./editPositionContext";
import {
    createAssociatedTokenAccountIdempotentInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";

export const increasePositionWithIncorrectUser = async (ctx: EditPositionContext) => {
    const now = new Date().getTime() / 1_000;

    try {
        if (ctx.isLongTest) {
            const [
                {
                    minOut,
                    downPayment,
                    principal,
                    fee
                }, position, pool, currencyVault, collateralVault
            ] = [
                defaultOpenLongPositionArgs,
                ctx.longPosition,
                ctx.longPool,
                ctx.longPoolCurrencyVault,
                ctx.longPoolCollateralVault
            ];

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

            //TODO: Fix for shorts
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
        } else {
            const [
                {
                    minOut,
                    downPayment,
                    principal,
                    fee
                }, position, pool, currencyVault, collateralVault
            ] = [
                defaultOpenShortPositionArgs,
                ctx.shortPosition,
                ctx.shortPool,
                ctx.shortPoolCurrencyVault,
                ctx.shortPoolCollateralVault
            ];

            const ownerAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                ctx.SWAP_AUTHORITY.publicKey,
                getAssociatedTokenAddressSync(
                    ctx.collateral,
                    ctx.SWAP_AUTHORITY.publicKey,
                    false,
                    TOKEN_PROGRAM_ID
                ),
                ctx.SWAP_AUTHORITY.publicKey,
                ctx.collateral,
                TOKEN_PROGRAM_ID
            );

            //TODO: Fix for shorts
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

        }

        assert.fail("Expected increase position to fail with constraint error");
    } catch (error) {
        if (/A seeds constraint was violated/.test(error.toString())) {
            assert.ok(true);
        } else {
            console.error(error);
            assert.ok(false);
        }
    }
}

export const decreasePositionWithIncorrectUser = async (ctx: EditPositionContext) => {
    try {
        if (ctx.isLongTest) {
            const [{minOut, interest, executionFee}, position, pool, currencyVault, collateralVault] =
                [
                    defaultCloseLongPositionArgs,
                    ctx.longPosition,
                    ctx.longPool,
                    ctx.longPoolCurrencyVault,
                    ctx.longPoolCollateralVault
                ];

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

            await ctx.closeLongPosition();
        } else {
            const [{minOut, interest, executionFee}, position, pool, currencyVault, collateralVault] = [
                defaultCloseShortPositionArgs,
                ctx.shortPosition,
                ctx.shortPool,
                ctx.shortPoolCurrencyVault,
                ctx.shortPoolCollateralVault
            ];

            const ownerAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                ctx.SWAP_AUTHORITY.publicKey,
                getAssociatedTokenAddressSync(
                    ctx.collateral,
                    ctx.SWAP_AUTHORITY.publicKey,
                    false,
                    TOKEN_PROGRAM_ID
                ),
                ctx.SWAP_AUTHORITY.publicKey,
                ctx.collateral,
                TOKEN_PROGRAM_ID
            );

            await ctx.closeShortPosition();
        }

        assert.fail("Expected decrease position to fail with constraint error");
    } catch (error) {
        if (/A seeds constraint was violated/.test(error.toString())) {
            assert.ok(true);
        } else {
            console.error(error);
            assert.ok(false);
        }
    }
}