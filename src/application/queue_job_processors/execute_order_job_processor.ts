import type { Job } from "bullmq";
import { ExecuteOrderException, ExecuteOrderExceptionType, OrderExecutor, type OrderExecutorResult } from "../../domain/order_executor.js";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { OrderRepository } from "../../domain/order/order_repository.js";
import { OrderFailureReason } from "../../domain/order/order.js";

export class ExecuteOrderJobProcessor {
    constructor(
        private readonly orderExecutor: OrderExecutor,
        private readonly orderRepository: OrderRepository,
    ) { }

    async executeOrder(job: Job) {
        const orderId = job.data.orderId!;

        try {
            const tokenIn = new PublicKey(job.data.tokenIn as string);
            const tokenOut = new PublicKey(job.data.tokenOut as string);
            const amount = new BN(job.data.amount as string, "hex");

            const result = await this.orderExecutor.executeOrder(orderId, tokenIn, tokenOut, amount, async (status, details) => {
                job.updateProgress({
                    status,
                    details,
                });
            });

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
        catch (err: any) {
            const maxAttempts = job.opts.attempts || 1;
            const isLastAttempt = job.attemptsMade >= (maxAttempts - 1);

            if (isLastAttempt) {
                const order = (await this.orderRepository.fetchWithId(orderId));
                if (order) {
                    let failureReason = OrderFailureReason.transactionFailed;

                    if (err instanceof ExecuteOrderException) {
                        failureReason = mapToDomainFailureReason(err.reason);
                    }

                    order.markAsFailed(failureReason);
                    await this.orderRepository.save(order);
                }
            }

            if (err instanceof ExecuteOrderException) {
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

            throw new Error(err.message || "Unknown error");
        }
    }
}

function mapToDomainFailureReason(reason: ExecuteOrderExceptionType): OrderFailureReason {
    switch (reason) {
        case ExecuteOrderExceptionType.noPoolAvailable:
            return OrderFailureReason.noPoolsFound;

        case ExecuteOrderExceptionType.slippage:
            return OrderFailureReason.slippage;

        case ExecuteOrderExceptionType.transactionFailed:
            return OrderFailureReason.transactionFailed;
    }
}