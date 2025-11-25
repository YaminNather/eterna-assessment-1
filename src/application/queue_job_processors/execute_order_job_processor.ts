import type { Job } from "bullmq";
import { ExecuteOrderException, ExecuteOrderExceptionType, OrderExecutor, type OrderExecutorResult } from "../../domain/order_executor.js";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { wait } from "../../utils/promise_utils.js";
import { OrderRepository } from "../../domain/order/order_repository.js";
import { OrderFailureReason } from "../../domain/order/order.js";

export class ExecuteOrderJobProcessor {
    constructor(
        private readonly orderExecutor: OrderExecutor,
        private readonly orderRepository: OrderRepository,
    ) {} 

    async executeOrder(job: Job) {
        const orderId = job.data.orderId!;

        // await wait(10 * 1000);

        const tokenIn = new PublicKey(job.data.tokenIn as string);
        const tokenOut = new PublicKey(job.data.tokenOut as string);
        const amount = new BN(job.data.amount as string, "hex");

        let result: OrderExecutorResult;
        try {
            result = await this.orderExecutor.executeOrder(orderId, tokenIn, tokenOut, amount, async (status, details) => {
                await job.updateProgress({
                    status,
                    details,
                });
            });
        }
        catch (err) {
            if (err instanceof ExecuteOrderException) {
                if (job.attemptsMade === 3) {
                    const order = (await this.orderRepository.fetchWithId(orderId))!;
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

            throw err;
        }
        
        const order = (await this.orderRepository.fetchWithId(orderId))!;
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

function mapToDomainFailureReason(reason: ExecuteOrderExceptionType): OrderFailureReason {
    switch (reason) {
        case ExecuteOrderExceptionType.noPoolAvailable:
            return OrderFailureReason.noPoolsFound;
        
        case ExecuteOrderExceptionType.slippage:
            return OrderFailureReason.slippage;
    }
}