import type { Logger } from "pino";
import type { DexRouter } from "./dex_router.js";
import type { Dex } from "./dex/dex.js";
import type { DexRegistry } from "./dex_registry.js";
import { PublicKey } from "@solana/web3.js";
import bs58 from 'bs58';
import BN from "bn.js";
import type { Quote } from "./dex/quote.js";
import { SlippageExceededError } from "./dex/errors.js";

export interface OrderExecutorResult {
    readonly dexId: string;
    readonly poolId: PublicKey;
    readonly transactionHash: string;
    readonly amountIn: BN;
    readonly amountOut: BN;
}

export class OrderExecutor {
    constructor(
        private readonly dexRegistry: DexRegistry,
        private readonly dexRouter: DexRouter,
        private readonly logger: Logger,
    ) { }

    async executeOrder(orderId: string, tokenIn: PublicKey, tokenOut: PublicKey, amount: BN, progressCallback: ExecuteOrderProgressCallback): Promise<OrderExecutorResult> {
        try {
            const quote: Quote = await this.routeToBestPool(orderId, tokenIn, tokenOut, amount, progressCallback);

            const dex: Dex = this.dexRegistry.withId(quote.dexId);

            const transactionHash = await this.executeSwap(orderId, quote, dex, tokenIn, progressCallback);

            const payer = new PublicKey(process.env['WALLET_PUBLIC_KEY'] as string);

            const { amountIn, amountOut } = await this.confirmSwap(orderId, transactionHash, dex, tokenIn, tokenOut, payer);

            return {
                dexId: dex.id,
                poolId: quote.poolId,
                transactionHash,
                amountIn,
                amountOut,
            };
        }
        catch (e) {
            if (e instanceof OrderExecutorException) {
                throw e;
            }

            throw new OrderExecutorException(OrderExecutorExceptionType.unknown, "Unknown error");
        }
    }

    private async routeToBestPool(orderId: string, tokenIn: PublicKey, tokenOut: PublicKey, amount: BN, progressCallback: ExecuteOrderProgressCallback): Promise<Quote> {
        progressCallback(ExecuteOrderStatus.routing);
        this.logger.info({ orderId }, 'Routing to the best possible pool');

        let quote: Quote | null;
        quote = await this.dexRouter.findBestValueDexForOrder(tokenIn, tokenOut, amount);

        if (!quote) {
            const error = new ExecuteOrderException(ExecuteOrderExceptionType.noPoolAvailable, "Could not find a pool meeting requirements");
            this.logger.error({ orderId, err: error }, error.message);

            throw error;
        }

        this.logger.info({ orderId, ...quote }, 'Routed to the best pool');

        return quote;
    }

    private async executeSwap(orderId: string, quote: Quote, dex: Dex, tokenIn: PublicKey, progressCallback: ExecuteOrderProgressCallback): Promise<string> {
        progressCallback(ExecuteOrderStatus.building);
        this.logger.info({ orderId, dex_id: quote.dexId, pool_id: quote.poolId, }, 'Building swap transaction');

        const payer = new PublicKey(process.env['WALLET_PUBLIC_KEY'] as string);
        const payerSecret = bs58.decode(process.env['WALLET_SECRET_KEY'] as string);

        let transactionHash: string;
        try {
            transactionHash = await dex.swap(payer, payerSecret, new PublicKey(quote.poolId), new PublicKey(tokenIn), quote);
        }
        catch (e) {
            this.logger.error({ orderId, err: e }, 'Failed to send swap transaction');

            if (e instanceof SlippageExceededError) {
                throw new ExecuteOrderException(ExecuteOrderExceptionType.slippage, "Slippage exceeded");
            }

            throw e;
        }
        progressCallback(ExecuteOrderStatus.submitted);
        this.logger.info({ orderId, dexId: quote.dexId, poolId: quote.poolId, amountIn: quote.inputAmount }, "Transaction submitted");

        return transactionHash;
    }

    private async confirmSwap(orderId: string, transactionHash: string, dex: Dex, tokenIn: PublicKey, tokenOut: PublicKey, owner: PublicKey): Promise<{ amountIn: BN, amountOut: BN }> {
        let confirmationResult;
        try {
            confirmationResult = await dex.confirmTransaction(transactionHash, tokenIn, tokenOut, owner);
        }
        catch (e: any) {
            this.logger.error({ orderId, transactionHash, err: e }, 'Transaction failed');

            if (e instanceof SlippageExceededError) {
                throw new ExecuteOrderException(ExecuteOrderExceptionType.slippage, "Slippage exceeded");
            }

            throw e;
        }
        this.logger.info({ orderId, transactionHash, amountIn: confirmationResult.amountIn, amountOut: confirmationResult.amountOut }, "Swap Transaction confirmed");

        return {
            amountIn: confirmationResult.amountIn,
            amountOut: confirmationResult.amountOut,
        };
    }
}

export type ExecuteOrderProgressCallback = (status: ExecuteOrderStatus, data?: any) => void;

export enum ExecuteOrderStatus {
    routing = 'routing',
    building = 'building',
    submitted = 'submitted',
}

export enum ExecuteOrderExceptionType {
    noPoolAvailable = "no_pool_available",
    slippage = "slippage",
    transactionFailed = "transaction_failed",
}

export class ExecuteOrderException extends Error {
    constructor(
        readonly reason: ExecuteOrderExceptionType,
        message: string,
        readonly details?: any,
    ) {
        super(message);
    }
}