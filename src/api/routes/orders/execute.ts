import type { FastifyReply, FastifyRequest } from "fastify";
import { OrderService } from "../../../application/services/order_service.js";
import { diContainer } from "@fastify/awilix";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export const executeRoute = '/execute';

export async function executeRouteHandler(request: FastifyRequest, reply: FastifyReply) {
    const orderService = diContainer.resolve<OrderService>('orderService');

    const { tokenIn, tokenInDecimal, tokenOut, tokenOutDecimal, amountIn: amount } = request.body as RequestBody;

    const orderId = await orderService.initiateExecuteOrder(
        new PublicKey(tokenIn), 
        tokenInDecimal,
        new PublicKey(tokenOut), 
        tokenOutDecimal,
        new BN(amount),
    );
    
    return {
        orderId
    } as ResponseBody;
}

interface RequestBody {
    tokenIn: string;
    tokenInDecimal: number;
    tokenOut: string;
    tokenOutDecimal: number;
    amountIn: string;
}

interface ResponseBody {
    orderId: string;
}