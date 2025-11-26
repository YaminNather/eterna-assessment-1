import { ExecuteOrderException, ExecuteOrderExceptionType } from "../../domain/order_executor.js";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { OrderFailureReason } from "../../domain/order/order.js";
export class ExecuteOrderJobProcessor {
    constructor(orderExecutor, orderRepository) {
        this.orderExecutor = orderExecutor;
        this.orderRepository = orderRepository;
    }
    async executeOrder(job) {
        const orderId = job.data.orderId;
        // await wait(10 * 1000);
        const tokenIn = new PublicKey(job.data.tokenIn);
        const tokenOut = new PublicKey(job.data.tokenOut);
        const amount = new BN(job.data.amount, "hex");
        let result;
        try {
            result = await this.orderExecutor.executeOrder(orderId, tokenIn, tokenOut, amount, async (status, details) => {
                job.updateProgress({
                    status,
                    details,
                });
            });
        }
        catch (err) {
            if (err instanceof ExecuteOrderException) {
                if (job.attemptsMade === 3) {
                    const order = (await this.orderRepository.fetchWithId(orderId));
                    order.markAsFailed(mapToDomainFailureReason(err.reason));
                    await this.orderRepository.save(order);
                }
                const errorMessage = JSON.stringify({
                    status: 'failed',
                    details: {
                        reason: err.reason,
                        message: err.message,
                        details: err.details,
                    },
                });
                throw new Error(errorMessage);
            }
            else if (!(err instanceof Error)) {
                throw new Error(JSON.stringify(err));
            }
            throw err;
        }
        const order = (await this.orderRepository.fetchWithId(orderId));
        order.markAsConfirmed(result.transactionHash, result.dexId, result.poolId, result.amountIn, result.amountOut);
        await this.orderRepository.save(order);
        return {
            status: "confirmed",
            details: {
                transactionHash: result.transactionHash,
                dexId: result.dexId,
                poolId: result.poolId.toBase58(),
                finalAmountIn: result.amountIn,
                finalAmountOut: result.amountOut,
            },
        };
    }
}
function mapToDomainFailureReason(reason) {
    switch (reason) {
        case ExecuteOrderExceptionType.noPoolAvailable:
            return OrderFailureReason.noPoolsFound;
        case ExecuteOrderExceptionType.slippage:
            return OrderFailureReason.slippage;
        case ExecuteOrderExceptionType.transactionFailed:
            return OrderFailureReason.transactionFailed;
    }
}
