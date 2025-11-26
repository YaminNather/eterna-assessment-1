import { CpAmm, getCurrentPoint, getTokenDecimals, getTokenProgram, SwapMode } from "@meteora-ag/cp-amm-sdk";
import { SendTransactionError } from "@solana/web3.js";
import { getFinalSwapAmounts } from "./utils.js";
export class MeteoraDexAdapter {
    constructor(connection) {
        this.connection = connection;
        this.cpAmm = new CpAmm(connection);
    }
    get id() {
        return 'meteora';
    }
    async getQuotes(tokenIn, tokenOut, amount) {
        let poolStates = await this.cpAmm.getAllPools();
        poolStates = poolStates.filter((e) => {
            return e.account.tokenAMint.toBase58() == tokenIn.toBase58() && e.account.tokenBMint.toBase58() == tokenOut.toBase58()
                || e.account.tokenBMint.toBase58() == tokenOut.toBase58() && e.account.tokenAMint.toBase58() == tokenIn.toBase58();
        });
        const fetchQuotePromises = poolStates.map((e) => this.getQuote(e.account, tokenIn, amount));
        const quotes = (await Promise.all(fetchQuotePromises))
            .map((e, index) => ({
            dexId: this.id,
            poolId: poolStates[index].publicKey,
            inputAmount: e.excludedFeeInputAmount,
            inputAmountWithFees: e.includedFeeInputAmount,
            outputAmount: e.outputAmount,
            minOutputAmount: e.minimumAmountOut,
        }));
        return quotes;
    }
    async swap(userPublicKey, userSecretKey, poolMint, tokenIn, quote) {
        const poolState = await this.cpAmm.fetchPoolState(poolMint);
        const currentPoint = await getCurrentPoint(this.connection, poolState.activationType);
        const tokenADecimal = await getTokenDecimals(this.connection, poolState.tokenAMint, getTokenProgram(poolState.tokenAFlag));
        const tokenBDecimal = await getTokenDecimals(this.connection, poolState.tokenBMint, getTokenProgram(poolState.tokenBFlag));
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
            amountIn: quote.inputAmountWithFees,
            minimumAmountOut: quote.outputAmount,
        });
        let txSignature;
        try {
            txSignature = await this.connection.sendTransaction(swapTx, [
                { publicKey: userPublicKey, secretKey: userSecretKey },
            ]);
        }
        catch (e) {
            if (e instanceof SendTransactionError) {
                const logs = await e.getLogs(this.connection);
                console.log("Meteora Swap error: ", logs);
            }
            throw e;
        }
        return txSignature;
    }
    async confirmTransaction(transactionHash, tokenIn, tokenOut) {
        await this.connection.confirmTransaction(transactionHash, "finalized");
        const { amountIn, amountOut } = await getFinalSwapAmounts(this.connection, transactionHash, tokenIn, tokenOut);
        return {
            amountIn,
            amountOut,
        };
    }
    async getQuote(poolState, tokenIn, amountIn) {
        const currentPoint = await getCurrentPoint(this.connection, poolState.activationType);
        const tokenADecimal = await getTokenDecimals(this.connection, poolState.tokenAMint, getTokenProgram(poolState.tokenAFlag));
        const tokenBDecimal = await getTokenDecimals(this.connection, poolState.tokenBMint, getTokenProgram(poolState.tokenBFlag));
        const quote = this.cpAmm.getQuote2({
            inputTokenMint: tokenIn,
            slippage: 1,
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
