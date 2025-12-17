import { UnrecoverableError, type Job } from "bullmq";
import {
    ExecuteOrderException,
    NoPoolAvailableException,
    SlippageExceededException,
    OrderExecutor,
} from "../../domain/order_executor.js";
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

            const orderExecutionResult = await this.orderExecutor.executeOrder(orderId, tokenIn, tokenOut, amount, async (status, details) => {
                job.updateProgress({
                    status,
                    details,
                });
            });

            const order = (await this.orderRepository.fetchWithId(orderId))!;
            order.markAsConfirmed(orderExecutionResult.transactionHash, orderExecutionResult.dexId, orderExecutionResult.poolId, orderExecutionResult.amountIn, orderExecutionResult.amountOut);
            await this.orderRepository.save(order);

            return {
                status: "confirmed",
                details: {
                    transactionHash: orderExecutionResult.transactionHash,
                    dexId: orderExecutionResult.dexId,
                    poolId: orderExecutionResult.poolId.toBase58(),
                    finalAmountIn: orderExecutionResult.amountIn,
                    finalAmountOut: orderExecutionResult.amountOut,
                },
            };
        }
        catch (err: any) {
            const maxAttempts = job.opts.attempts || 1;
            const isLastAttempt = job.attemptsMade >= (maxAttempts - 1);

            if (isLastAttempt) {
                const order = await this.orderRepository.fetchWithId(orderId);
                if (order) {
                    let failureReason = OrderFailureReason.transactionFailed;

                    if (err instanceof NoPoolAvailableException) {
                        failureReason = OrderFailureReason.noPoolsFound;
                    } else if (err instanceof SlippageExceededException) {
                        failureReason = OrderFailureReason.slippage;
                    }

                    order.markAsFailed(failureReason);
                    await this.orderRepository.save(order);
                }
            }

            if (err instanceof ExecuteOrderException) {
                const errorMessage = JSON.stringify({
                    status: 'failed',
                    details: {
                        reason: err.constructor.name,
                        message: err.message,
                        details: err.details,
                    },
                });
                throw new Error(errorMessage);
            }

            throw new UnrecoverableError(err.message || "Unknown error");
        }
    }
}