import { CpAmm, getCurrentPoint, getTokenDecimals, getTokenProgram, SwapMode, type PoolState, type Quote2Result } from "@meteora-ag/cp-amm-sdk";
import type { ConfirmationResult, Dex } from "../../domain/dex/dex.js";
import type { Quote } from "../../domain/dex/quote.js";
import { PublicKey, SendTransactionError, type Connection, type TransactionSignature } from "@solana/web3.js";
import BN from "bn.js";
import { getFinalSwapAmounts } from "./utils.js";
import { getReadableError } from "./error_parser.js";
import { Logger } from "pino";

export class MeteoraDexAdapter implements Dex {
    private readonly cpAmm: CpAmm;

    constructor(
        private readonly connection: Connection,
        private readonly logger: Logger,
    ) {
        this.cpAmm = new CpAmm(connection);
    }

    get id(): string {
        return 'meteora';
    }

    async getQuotes(tokenIn: PublicKey, tokenOut: PublicKey, amount: BN): Promise<Quote[]> {
        let poolStates = await this.cpAmm.getAllPools();
        poolStates = poolStates.filter((e) => {
            return e.account.tokenAMint.toBase58() == tokenIn.toBase58() && e.account.tokenBMint.toBase58() == tokenOut.toBase58()
                || e.account.tokenBMint.toBase58() == tokenOut.toBase58() && e.account.tokenAMint.toBase58() == tokenIn.toBase58();
        });

        const fetchQuotePromises = poolStates.map((e) => this.getQuote(e.account, tokenIn, amount));
        const quotes = (await Promise.all(fetchQuotePromises))
            .map((e, index) => {
                // this.logger.error({ e }, "MeteoraDexAdapter.getQuotes");

                return ({
                    dexId: this.id,
                    poolId: poolStates[index]!.publicKey,

                    inputAmount: e.excludedFeeInputAmount,
                    outputAmount: e.outputAmount,
                    minOutputAmount: e.minimumAmountOut,
                } as Quote);
            });

        return quotes;
    }

    async swap(userPublicKey: PublicKey, userSecretKey: Uint8Array, poolMint: PublicKey, tokenIn: PublicKey, quote: Quote): Promise<string> {
        const poolState = await this.cpAmm.fetchPoolState(poolMint);

        const inputTokenMint = poolState.tokenAMint;
        const outputTokenMint = poolState.tokenBMint;

        const swapTx = await this.cpAmm.swap2({
            payer: userPublicKey,
            pool: poolMint,

            tokenAVault: poolState.tokenAVault,
            tokenAMint: poolState.tokenAMint,
            tokenAProgram: getTokenProgram(poolState.tokenAFlag),

            tokenBVault: poolState.tokenBVault,
            tokenBMint: poolState.tokenBMint,
            tokenBProgram: getTokenProgram(poolState.tokenBFlag),

            inputTokenMint: inputTokenMint,
            outputTokenMint: outputTokenMint,

            referralTokenAccount: null,
            swapMode: SwapMode.ExactIn,
            amountIn: quote.inputAmount,
            minimumAmountOut: quote.minOutputAmount!,
        });

        let txSignature: TransactionSignature;
        try {
            txSignature = await this.connection.sendTransaction(swapTx, [
                { publicKey: userPublicKey, secretKey: userSecretKey },
            ]);
        } catch (e: any) {
            const readableError = getReadableError(e);
            throw new Error(`Meteora swap failed: ${readableError}`);
        }

        return txSignature;
    }

    async confirmTransaction(transactionHash: string, tokenIn: PublicKey, tokenOut: PublicKey, owner: PublicKey): Promise<ConfirmationResult> {
        await this.connection.confirmTransaction(transactionHash, "finalized");

        const { amountIn, amountOut } = await getFinalSwapAmounts(this.connection, transactionHash, tokenIn, tokenOut, owner);

        return {
            amountIn,
            amountOut,
        }
    }


    private async getQuote(poolState: PoolState, tokenIn: PublicKey, amountIn: BN): Promise<Quote2Result> {
        const currentPoint = await getCurrentPoint(
            this.connection,
            poolState.activationType,
        );

        const tokenADecimal = await getTokenDecimals(this.connection, poolState.tokenAMint, getTokenProgram(poolState.tokenAFlag));
        const tokenBDecimal = await getTokenDecimals(this.connection, poolState.tokenBMint, getTokenProgram(poolState.tokenBFlag));

        const quote = this.cpAmm.getQuote2({
            inputTokenMint: tokenIn,
            slippage: 5 / 100,
            currentPoint,
            poolState,
            tokenADecimal,
            tokenBDecimal,
            hasReferral: false,
            swapMode: SwapMode.ExactIn,
            amountIn,
        });

        return quote;
    }
}