import { Order, OrderFailureReason, OrderStatus } from "../../../domain/order/order.js";
import { OrderRepository } from "../../../domain/order/order_repository.js";
import {
    OrderStatus as OrderStatusDb,
    OrderFailureReason as OrderFailureReasonDb,
    type PrismaClient,
    Dex,
} from "../../../generated/prisma/client.js";

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export class PrismaOrderRepository implements OrderRepository {
    constructor(
        private readonly prisma: PrismaClient,
    ) {}

    async fetchWithId(id: string): Promise<Order | null> {
        const dbModel = await this.prisma.swapOrder.findUnique({
            where: { id },
        });

        if (!dbModel) return null;

        const domainModel = new Order({
            id: dbModel.id,

            status: mapOrderStatusFromDb(dbModel.status),

            tokenIn: new PublicKey(dbModel.tokenInId),
            tokenInDecimal: dbModel.tokenInDecimal,
            tokenOut: new PublicKey(dbModel.tokenOutId),
            tokenOutDecimal: dbModel.tokenOutDecimal,

            amountIn: new BN(dbModel.amountIn.toString()),

            transactionHash: dbModel.transactionHash ?? undefined,
            dexId: dbModel.dexId ? mapDexToDomain(dbModel.dexId) : undefined,
            poolId: dbModel.poolId ? new PublicKey(dbModel.poolId) : undefined,
            finalAmountIn: dbModel.finalAmountIn === null ? undefined : new BN(dbModel.finalAmountIn.toString()),
            finalAmountOut: dbModel.finalAmountOut === null ? undefined : new BN(dbModel.finalAmountOut.toString()),


            confirmedAt: dbModel.confirmedAt ?? undefined,

            failureReason: dbModel.failureReason
                ? mapFailureReasonFromDb(dbModel.failureReason)
                : undefined,
        });

        return domainModel;
    }

    async save(order: Order): Promise<void> {
        await this.prisma.swapOrder.upsert({
            where: { id: order.id },
            create: {
                id: order.id,

                status: mapOrderStatusToDb(order.status),

                tokenInId: order.tokenIn.toString(),
                tokenInDecimal: order.tokenInDecimal,

                tokenOutId: order.tokenOut.toString(),
                tokenOutDecimal: order.tokenOutDecimal,

                amountIn: BigInt(order.amountIn.toString()),

                transactionHash: order.transactionHash || null,
                dexId: order.dexId ? mapDexToDb(order.dexId) : null,
                poolId: order.poolId ? order.poolId.toBase58() : null,
                finalAmountIn: order.finalAmountIn ? BigInt(order.finalAmountIn.toString()) : null,
                finalAmountOut: order.finalAmountOut ? BigInt(order.finalAmountOut.toString()) : null,


                confirmedAt: order.confirmedAt ? order.confirmedAt : null,
                failureReason: order.failureReason
                    ? mapFailureReasonToDb(order.failureReason)
                    : null,
            },
            update: {
                status: mapOrderStatusToDb(order.status),

                finalAmountIn: order.finalAmountIn ? BigInt(order.finalAmountIn.toString()) : null,
                finalAmountOut: order.finalAmountOut ? BigInt(order.finalAmountOut.toString()) : null,

                dexId: order.dexId ? mapDexToDb(order.dexId) : null,
                poolId: order.poolId ? order.poolId.toBase58() : null,

                confirmedAt: order.confirmedAt ? order.confirmedAt : null,
                failureReason: order.failureReason
                    ? mapFailureReasonToDb(order.failureReason)
                    : null,
            },
        });
    }
}

function mapOrderStatusToDb(domainModel: OrderStatus): OrderStatusDb {
    switch (domainModel) {
        case OrderStatus.confirmed:
            return OrderStatusDb.CONFIRMED;
        
        case OrderStatus.failed:
            return OrderStatusDb.FAILED;

        case OrderStatus.pending:
            return OrderStatusDb.PENDING;
    }
}

function mapOrderStatusFromDb(db: OrderStatusDb): OrderStatus {
    switch (db) {
        case OrderStatusDb.CONFIRMED:
            return OrderStatus.confirmed;
        case OrderStatusDb.FAILED:
            return OrderStatus.failed;
        case OrderStatusDb.PENDING:
            return OrderStatus.pending;
    }
}

function mapFailureReasonToDb(domainModel: OrderFailureReason): OrderFailureReasonDb {
    switch (domainModel) {
        case OrderFailureReason.noPoolsFound:
            return OrderFailureReasonDb.NOPOOLSFOUND;
        case OrderFailureReason.slippage:
            return OrderFailureReasonDb.SLIPPAGE;
    }
}

function mapFailureReasonFromDb(db: OrderFailureReasonDb): OrderFailureReason {
    switch (db) {
        case OrderFailureReasonDb.NOPOOLSFOUND:
            return OrderFailureReason.noPoolsFound;
        case OrderFailureReasonDb.SLIPPAGE:
            return OrderFailureReason.slippage;
    }
}

function mapDexToDb(domain: string): Dex {
    switch (domain) {
        case "meteora":
            return Dex.METEORA;
        case "raydium":
            return Dex.RAYDIUM;
        
        default:
            throw new Error(`Invalid dex id ${domain}`);
    }
}

function mapDexToDomain(db: Dex): string {
    switch (db) {
        case Dex.METEORA:
            return "meteora";
        case Dex.RAYDIUM:
            return "raydium";
    }
}