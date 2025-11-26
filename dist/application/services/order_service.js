import { Order } from "../../domain/order/order.js";
import * as uuid from "uuid";
export class OrderService {
    constructor(orderRepository, orderQueue) {
        this.orderRepository = orderRepository;
        this.orderQueue = orderQueue;
    }
    async initiateExecuteOrder(tokenIn, tokenInDecimal, tokenOut, tokenOutDecimal, amount) {
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
