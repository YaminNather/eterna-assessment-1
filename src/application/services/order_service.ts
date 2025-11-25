import type { Queue } from "bullmq";
import { Order } from "../../domain/order/order.js";
import type { OrderRepository } from "../../domain/order/order_repository.js";
import * as uuid from "uuid";
import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

export class OrderService {
    constructor(
        private readonly orderRepository: OrderRepository,
        private readonly orderQueue: Queue,
    ) {}

    async initiateExecuteOrder(tokenIn: PublicKey, tokenInDecimal: number, tokenOut: PublicKey, tokenOutDecimal: number, amount: BN): Promise<String> {
        const order = Order.create(uuid.v4(), tokenIn, tokenInDecimal, tokenOut, tokenOutDecimal, amount);

        await this.orderRepository.save(order);

        const jobId = `execute_order_${order.id}`;
        const jobData = { 
            orderId: order.id,
            tokenIn: tokenIn.toBase58(), 
            tokenOut: tokenOut.toBase58(), 
            amount: amount.toJSON(),
        };
        this.orderQueue.add('execute_order', jobData, { jobId, attempts: 3 });
        
        return order.id;
    }
}