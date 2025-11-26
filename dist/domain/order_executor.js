import { PublicKey } from "@solana/web3.js";
import bs58 from 'bs58';
export class OrderExecutor {
    constructor(dexRegistry, dexRouter, logger) {
        this.dexRegistry = dexRegistry;
        this.dexRouter = dexRouter;
        this.logger = logger;
    }
    async executeOrder(orderId, tokenIn, tokenOut, amount, progressCallback) {
        const quote = await this.routeToBestPool(orderId, tokenIn, tokenOut, amount, progressCallback);
        const dex = this.dexRegistry.withId(quote.dexId);
        const transactionHash = await this.executeSwap(orderId, quote, dex, tokenIn, progressCallback);
        const { amountIn, amountOut } = await this.confirmSwap(orderId, transactionHash, dex, tokenIn, tokenOut);
        return {
            dexId: dex.id,
            poolId: quote.poolId,
            transactionHash,
            amountIn,
            amountOut,
        };
    }
    async routeToBestPool(orderId, tokenIn, tokenOut, amount, progressCallback) {
        progressCallback(ExecuteOrderStatus.routing);
        this.logger.info({ orderId }, 'Routing to the best possible pool');
        let quote;
        quote = await this.dexRouter.findBestValueDexForOrder(tokenIn, tokenOut, amount);
        if (!quote) {
            const error = new ExecuteOrderException(ExecuteOrderExceptionType.noPoolAvailable, "Could not find a pool meeting requirements");
            this.logger.error({ orderId, err: error }, error.message);
            throw error;
        }
        this.logger.info({ orderId, ...quote }, 'Routed to the best pool');
        return quote;
    }
    async executeSwap(orderId, quote, dex, tokenIn, progressCallback) {
        progressCallback(ExecuteOrderStatus.building);
        this.logger.info({ orderId, dex_id: quote.dexId, pool_id: quote.poolId, }, 'Building swap transaction');
        const payer = new PublicKey(process.env['WALLET_PUBLIC_KEY']);
        const payerSecret = bs58.decode(process.env['WALLET_SECRET_KEY']);
        let transactionHash;
        try {
            transactionHash = await dex.swap(payer, payerSecret, new PublicKey(quote.poolId), new PublicKey(tokenIn), quote);
        }
        catch (e) {
            this.logger.error({ orderId, err: e }, 'Failed to send swap transaction');
            throw e;
        }
        progressCallback(ExecuteOrderStatus.submitted);
        this.logger.info({ orderId, dexId: quote.dexId, poolId: quote.poolId, amountIn: quote.inputAmountWithFees }, "Transaction submitted");
        return transactionHash;
    }
    async confirmSwap(orderId, transactionHash, dex, tokenIn, tokenOut) {
        let confirmationResult;
        try {
            confirmationResult = await dex.confirmTransaction(transactionHash, tokenIn, tokenOut);
        }
        catch (e) {
            this.logger.error({ orderId, err: e }, 'Transaction failed');
            throw new ExecuteOrderException(ExecuteOrderExceptionType.transactionFailed, "Transaction Failed");
        }
        this.logger.info({ orderId, transactionHash, amountIn: confirmationResult.amountIn, amountOut: confirmationResult.amountOut }, "Swap Transaction confirmed");
        return {
            amountIn: confirmationResult.amountIn,
            amountOut: confirmationResult.amountOut,
        };
    }
}
export var ExecuteOrderStatus;
(function (ExecuteOrderStatus) {
    ExecuteOrderStatus["routing"] = "routing";
    ExecuteOrderStatus["building"] = "building";
    ExecuteOrderStatus["submitted"] = "submitted";
})(ExecuteOrderStatus || (ExecuteOrderStatus = {}));
export var ExecuteOrderExceptionType;
(function (ExecuteOrderExceptionType) {
    ExecuteOrderExceptionType["noPoolAvailable"] = "no_pool_available";
    ExecuteOrderExceptionType["slippage"] = "slippage";
    ExecuteOrderExceptionType["transactionFailed"] = "transaction_failed";
})(ExecuteOrderExceptionType || (ExecuteOrderExceptionType = {}));
export class ExecuteOrderException extends Error {
    constructor(reason, message, details) {
        super(message);
        this.reason = reason;
        this.details = details;
    }
}
