//import * as anchor from "@coral-xyz/anchor";
//import { WasabiSolana } from "../target/types/wasabi_solana";
//import { assert } from "chai";
//import {
//    abSwapKey,
//    poolFeeAccount,
//    poolMint,
//    SWAP_AUTHORITY,
//    swapTokenAccountA,
//    swapTokenAccountB,
//    tokenMintA,
//    tokenMintB,
//    feeWalletKeypair,
//} from "./rootHooks";
//import { TOKEN_SWAP_PROGRAM_ID, TokenSwap } from "@solana/spl-token-swap";
//import {
//    getAssociatedTokenAddressSync,
//    TOKEN_PROGRAM_ID,
//} from "@solana/spl-token";
//import { getMultipleTokenAccounts } from "./utils";
//
//describe("ClaimPosition", () => {
//    const program = anchor.workspace.WasabiSolana as anchor.Program<WasabiSolana>;
//    const [coSignerPermission] = anchor.web3.PublicKey.findProgramAddressSync(
//        [
//            anchor.utils.bytes.utf8.encode("admin"),
//            SWAP_AUTHORITY.publicKey.toBuffer(),
//        ],
//        program.programId,
//    );
//
//    const feeWallet = getAssociatedTokenAddressSync(
//        tokenMintA, 
//        feeWalletKeypair.publicKey, 
//        true, 
//        TOKEN_PROGRAM_ID
//    );
//
//    const ownerTokenA = getAssociatedTokenAddressSync(
//        tokenMintA,
//        program.provider.publicKey,
//        false,
//    );
//    const ownerTokenB = getAssociatedTokenAddressSync(
//        tokenMintB,
//        program.provider.publicKey,
//        false,
//    );
//    const [lpVaultKeyA] = anchor.web3.PublicKey.findProgramAddressSync(
//        [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintA.toBuffer()],
//        program.programId,
//    );
//    const lpVaultAVault = getAssociatedTokenAddressSync(
//        tokenMintA,
//        lpVaultKeyA,
//        true,
//    );
//    const [lpVaultKeyB] = anchor.web3.PublicKey.findProgramAddressSync(
//        [anchor.utils.bytes.utf8.encode("lp_vault"), tokenMintB.toBuffer()],
//        program.programId,
//    );
//    const lpVaultBVault = getAssociatedTokenAddressSync(
//        tokenMintB,
//        lpVaultKeyB,
//        true,
//    );
//
//    const [longPoolBKey] = anchor.web3.PublicKey.findProgramAddressSync(
//        [
//            anchor.utils.bytes.utf8.encode("long_pool"),
//            tokenMintB.toBuffer(),
//            tokenMintA.toBuffer(),
//        ],
//        program.programId,
//    );
//    const longPoolBVaultKey = getAssociatedTokenAddressSync(
//        tokenMintB,
//        longPoolBKey,
//        true,
//    );
//    const longPoolBCurrencyVaultKey = getAssociatedTokenAddressSync(
//        tokenMintA,
//        longPoolBKey,
//        true,
//    );
//    const [shortPoolAKey] = anchor.web3.PublicKey.findProgramAddressSync(
//        [
//            anchor.utils.bytes.utf8.encode("short_pool"),
//            tokenMintA.toBuffer(),
//            tokenMintB.toBuffer(),
//        ],
//        program.programId,
//    );
//    const shortPoolAVaultKey = getAssociatedTokenAddressSync(
//        tokenMintA,
//        shortPoolAKey,
//        true,
//    );
//    const shortPoolACurrencyVaultKey = getAssociatedTokenAddressSync(
//        tokenMintB,
//        shortPoolAKey,
//        true,
//    );
//
//    before(async () => { });
//
//    describe("Short position", async () => {
//        let positionKey: anchor.web3.PublicKey;
//        before(async () => {
//            const nonce = 0;
//            const fee = new anchor.BN(10);
//            [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
//                [
//                    anchor.utils.bytes.utf8.encode("position"),
//                    program.provider.publicKey.toBuffer(),
//                    shortPoolAKey.toBuffer(),
//                    lpVaultKeyB.toBuffer(),
//                    new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
//                ],
//                program.programId,
//            );
//            const now = new Date().getTime() / 1_000;
//            const downPayment = new anchor.BN(1_000);
//            // amount to be borrowed
//            const principal = new anchor.BN(1_000);
//            const swapAmount = principal;
//            const minTargetAmount = new anchor.BN(1);
//            const args = {
//                nonce: 0,
//                minTargetAmount,
//                downPayment,
//                principal,
//                fee,
//                expiration: new anchor.BN(now + 3_600),
//            };
//            const setupIx = await program.methods
//                .openShortPositionSetup(
//                    args.nonce,
//                    args.minTargetAmount,
//                    args.downPayment,
//                    args.principal,
//                    args.fee,
//                    args.expiration,
//                )
//                .accounts({
//                    owner: program.provider.publicKey,
//                    lpVault: lpVaultKeyB,
//                    pool: shortPoolAKey,
//                    currency: tokenMintB,
//                    collateral: tokenMintA,
//                    permission: coSignerPermission,
//                    //@ts-ignore
//                    authority: SWAP_AUTHORITY.publicKey,
//                    feeWallet,
//                    currencyTokenProgram: TOKEN_PROGRAM_ID,
//                    collateralTokenProgram: TOKEN_PROGRAM_ID,
//                })
//                .instruction();
//            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                [abSwapKey.publicKey.toBuffer()],
//                TOKEN_SWAP_PROGRAM_ID,
//            );
//            const swapIx = TokenSwap.swapInstruction(
//                abSwapKey.publicKey,
//                swapAuthority,
//                SWAP_AUTHORITY.publicKey,
//                shortPoolACurrencyVaultKey,
//                swapTokenAccountB,
//                swapTokenAccountA,
//                shortPoolAVaultKey,
//                poolMint,
//                poolFeeAccount,
//                null,
//                tokenMintB,
//                tokenMintA,
//                TOKEN_SWAP_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                BigInt(swapAmount.toString()),
//                BigInt(minTargetAmount.toString()),
//            );
//            await program.methods
//                .openShortPositionCleanup()
//                .accounts({
//                    owner: program.provider.publicKey,
//                    pool: shortPoolAKey,
//                    //@ts-ignore
//                    lpVault: lpVaultKeyB,
//                    collateral: tokenMintA,
//                    currency: tokenMintB,
//                    position: positionKey,
//                    tokenProgram: TOKEN_PROGRAM_ID,
//                })
//                .preInstructions([setupIx, swapIx])
//                .signers([SWAP_AUTHORITY])
//                .rpc({ skipPreflight: true });
//        });
//        it("should successfully pay loan and return collateral to user", async () => {
//            const [
//                positionBefore,
//                [
//                    ownerTokenABefore,
//                    ownerTokenBBefore,
//                    lpVaultTokenBBefore,
//                    collateralVaultBefore,
//                    feeWalletBefore,
//                ],
//            ] = await Promise.all([
//                program.account.position.fetch(positionKey),
//                getMultipleTokenAccounts(program.provider.connection, [
//                    ownerTokenA,
//                    ownerTokenB,
//                    lpVaultBVault,
//                    shortPoolAVaultKey,
//                    feeWallet,
//                ], TOKEN_PROGRAM_ID),
//            ]);
//
//            assert.ok(positionBefore.trader.equals(program.provider.publicKey));
//
//            const computedMaxInterest = new anchor.BN(1);
//
//            await program.methods
//                .claimPosition()
//                .accounts({
//                    position: positionKey,
//                    pool: shortPoolAKey,
//                    collateral: tokenMintA,
//                    currency: tokenMintB,
//                    //@ts-ignore
//                    feeWallet,
//                    currencyTokenProgram: TOKEN_PROGRAM_ID,
//                    collateralTokenProgram: TOKEN_PROGRAM_ID,
//                })
//                .rpc();
//
//            const [
//                positionAfter,
//                [
//                    ownerTokenAAfter,
//                    ownerTokenBAfter,
//                    lpVaultTokenBAfter,
//                    collateralVaultAfter,
//                    feeWalletAfter,
//                ],
//            ] = await Promise.all([
//                program.account.position.fetchNullable(positionKey),
//                getMultipleTokenAccounts(program.provider.connection, [
//                    ownerTokenA,
//                    ownerTokenB,
//                    lpVaultBVault,
//                    shortPoolAVaultKey,
//                    feeWallet,
//                ], TOKEN_PROGRAM_ID),
//            ]);
//            // validate position was closed
//            assert.ok(positionAfter === null);
//            // validate principal (in tokenB) and interest (in tokenB) was paid by the trader
//            const expectedTokenDeltaB = computedMaxInterest.add(
//                positionBefore.principal,
//            );
//            const ownerBDiff = ownerTokenBAfter.amount - ownerTokenBBefore.amount;
//            assert.equal(ownerBDiff.toString(), expectedTokenDeltaB.neg().toString());
//            // validate the LP Vault received the interest and principal
//            const lpVaultTokenBDiff =
//                lpVaultTokenBAfter.amount - lpVaultTokenBBefore.amount;
//            assert.equal(
//                lpVaultTokenBDiff.toString(),
//                expectedTokenDeltaB.toString(),
//            );
//            // Validate the Trader recevied the collateral.
//            const expectedCollateralChange = positionBefore.collateralAmount.sub(
//                positionBefore.feesToBePaid,
//            );
//            const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
//            assert.equal(ownerADiff.toString(), expectedCollateralChange.toString());
//            // Validate the Pool's collateral_vault paid the collateral.
//            const collateralVaultDiff =
//                collateralVaultAfter.amount - collateralVaultBefore.amount;
//            assert.equal(
//                collateralVaultDiff.toString(),
//                expectedCollateralChange
//                    .add(positionBefore.feesToBePaid)
//                    .neg()
//                    .toString(),
//            );
//            // Validate the close_fee was paid out
//            const expectedCloseFee = positionBefore.feesToBePaid;
//            const feeWalletDiff = feeWalletAfter.amount - feeWalletBefore.amount;
//            assert.equal(feeWalletDiff.toString(), expectedCloseFee.toString());
//        });
//    });
//
//    describe("Long position", async () => {
//        let positionKey: anchor.web3.PublicKey;
//        before(async () => {
//            const nonce = 1;
//            const fee = new anchor.BN(10);
//            const now = new Date().getTime() / 1_000;
//            const downPayment = new anchor.BN(1_000);
//            // amount to be borrowed
//            const principal = new anchor.BN(1_000);
//            const swapAmount = downPayment.add(principal);
//            const minimumAmountOut = new anchor.BN(1_900);
//            [positionKey] = anchor.web3.PublicKey.findProgramAddressSync(
//                [
//                    anchor.utils.bytes.utf8.encode("position"),
//                    program.provider.publicKey.toBuffer(),
//                    longPoolBKey.toBuffer(),
//                    lpVaultKeyA.toBuffer(),
//                    new anchor.BN(nonce).toArrayLike(Buffer, "le", 2),
//                ],
//                program.programId,
//            );
//
//            const args = {
//                nonce,
//                minTargetAmount: minimumAmountOut,
//                downPayment,
//                principal,
//                fee,
//                expiration: new anchor.BN(now + 3_600),
//            };
//            const setupIx = await program.methods
//                .openLongPositionSetup(
//                    args.nonce,
//                    args.minTargetAmount,
//                    args.downPayment,
//                    args.principal,
//                    args.fee,
//                    args.expiration,
//                )
//                .accounts({
//                    owner: program.provider.publicKey,
//                    lpVault: lpVaultKeyA,
//                    pool: longPoolBKey,
//                    collateral: tokenMintB,
//                    currency: tokenMintA,
//                    permission: coSignerPermission,
//                    //@ts-ignore
//                    authority: SWAP_AUTHORITY.publicKey,
//                    feeWallet,
//                    tokenProgram: TOKEN_PROGRAM_ID,
//                })
//                .instruction();
//            const [swapAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
//                [abSwapKey.publicKey.toBuffer()],
//                TOKEN_SWAP_PROGRAM_ID,
//            );
//            const swapIx = TokenSwap.swapInstruction(
//                abSwapKey.publicKey,
//                swapAuthority,
//                SWAP_AUTHORITY.publicKey,
//                longPoolBCurrencyVaultKey,
//                swapTokenAccountA,
//                swapTokenAccountB,
//                longPoolBVaultKey,
//                poolMint,
//                poolFeeAccount,
//                null,
//                tokenMintA,
//                tokenMintB,
//                TOKEN_SWAP_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                TOKEN_PROGRAM_ID,
//                BigInt(swapAmount.toString()),
//                BigInt(minimumAmountOut.toString()),
//            );
//            await program.methods
//                .openLongPositionCleanup()
//                .accounts({
//                    owner: program.provider.publicKey,
//                    pool: longPoolBKey,
//                    position: positionKey,
//                    tokenProgram: TOKEN_PROGRAM_ID,
//                })
//                .preInstructions([setupIx, swapIx])
//                .signers([SWAP_AUTHORITY])
//                .rpc({ skipPreflight: true });
//        });
//        it("should successfully pay loan and return collateral to user", async () => {
//            const [
//                positionBefore,
//                [
//                    ownerTokenABefore,
//                    ownerTokenBBefore,
//                    lpVaultTokenABefore,
//                    collateralVaultBefore,
//                    feeWalletBefore,
//                ],
//            ] = await Promise.all([
//                program.account.position.fetch(positionKey),
//                getMultipleTokenAccounts(program.provider.connection, [
//                    ownerTokenA,
//                    ownerTokenB,
//                    lpVaultAVault,
//                    longPoolBVaultKey,
//                    feeWallet,
//                ], TOKEN_PROGRAM_ID),
//            ]);
//
//            assert.ok(positionBefore.trader.equals(program.provider.publicKey));
//
//            const computedMaxInterest = new anchor.BN(1);
//
//            await program.methods
//                .claimPosition()
//                .accounts({
//                    collateral: tokenMintB,
//                    currency: tokenMintA,
//                    position: positionKey,
//                    pool: longPoolBKey,
//                    //@ts-ignore
//                    feeWallet,
//                    currencyTokenProgram: TOKEN_PROGRAM_ID,
//                    collateralTokenProgram: TOKEN_PROGRAM_ID,
//                })
//                .rpc({ skipPreflight: true });
//
//            const [
//                positionAfter,
//                [
//                    ownerTokenAAfter,
//                    ownerTokenBAfter,
//                    lpVaultTokenAAfter,
//                    collateralVaultAfter,
//                    feeWalletAfter,
//                ],
//            ] = await Promise.all([
//                program.account.position.fetchNullable(positionKey),
//                getMultipleTokenAccounts(program.provider.connection, [
//                    ownerTokenA,
//                    ownerTokenB,
//                    lpVaultAVault,
//                    longPoolBVaultKey,
//                    feeWallet,
//                ], TOKEN_PROGRAM_ID),
//            ]);
//
//            // validate position was closed
//            assert.ok(positionAfter === null);
//            // validate principal (in tokenA) + interest (in tokenA) + fees was paid by the trader
//            const expectedTokenDeltaA = computedMaxInterest
//                .add(positionBefore.principal)
//                .add(positionBefore.feesToBePaid);
//            const ownerADiff = ownerTokenAAfter.amount - ownerTokenABefore.amount;
//            assert.equal(ownerADiff.toString(), expectedTokenDeltaA.neg().toString());
//            // Validate the close_fee was paid out
//            const expectedCloseFee = positionBefore.feesToBePaid;
//            const feeWalletDiff = feeWalletAfter.amount - feeWalletBefore.amount;
//            assert.equal(feeWalletDiff.toString(), expectedCloseFee.toString());
//            // validate the LP Vault received the interest and principal
//            const expectedLPVaultDiff = computedMaxInterest.add(
//                positionBefore.principal,
//            );
//            const lpVaultTokenADiff =
//                lpVaultTokenAAfter.amount - lpVaultTokenABefore.amount;
//            assert.equal(
//                lpVaultTokenADiff.toString(),
//                expectedLPVaultDiff.toString(),
//            );
//            // Validate the Trader recevied the collateral.
//            const expectedCollateralChange = positionBefore.collateralAmount;
//            const ownerBDiff = ownerTokenBAfter.amount - ownerTokenBBefore.amount;
//            assert.equal(ownerBDiff.toString(), expectedCollateralChange.toString());
//            // Validate the Pool's collateral_vault paid the collateral.
//            const collateralVaultDiff =
//                collateralVaultAfter.amount - collateralVaultBefore.amount;
//            assert.equal(
//                collateralVaultDiff.toString(),
//                expectedCollateralChange.neg().toString(),
//            );
//        });
//    });
//});
