import { diContainer } from "@fastify/awilix";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
export const executeRoute = '/execute';
export async function executeRouteHandler(request, reply) {
    const orderService = diContainer.resolve('orderService');
    const { tokenIn, tokenInDecimal, tokenOut, tokenOutDecimal, amountIn: amount } = request.body;
    const orderId = await orderService.initiateExecuteOrder(new PublicKey(tokenIn), tokenInDecimal, new PublicKey(tokenOut), tokenOutDecimal, new BN(amount));
    return {
        orderId
    };
}
