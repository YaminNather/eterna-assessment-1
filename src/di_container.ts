import { diContainer } from '@fastify/awilix';
import { asClass, asFunction, asValue, InjectionMode } from 'awilix';
import { PrismaOrderRepository } from './infrastructure/repositories/order_repository/prisma_order_repository.js';
import { OrderExecutor } from './domain/order_executor.js';
import { DexRegistry } from './domain/dex_registry.js';
import { DexRouter } from './domain/dex_router.js';
import { MeteoraDexAdapter } from './infrastructure/dexes/meteora_dex_adapter.js';
import { Connection } from '@solana/web3.js';
import { logger } from './logger.js';
import type pino from 'pino';
import { OrderService } from './application/services/order_service.js';
import { Queue, QueueEvents } from 'bullmq';
import { ExecuteOrderJobProcessor } from './application/queue_job_processors/execute_order_job_processor.js';
import { RaydiumDexAdapter } from './infrastructure/dexes/raydium_dex_adapter.js';
import { prisma } from './prisma.js';

export function setupDiContainer() {
    diContainer.options.injectionMode = InjectionMode.CLASSIC;

    diContainer.register({
        logger: asFunction<pino.Logger>(() => logger).singleton(),
            
        prisma: asValue(prisma),

        connection: asValue(new Connection("https://api.devnet.solana.com")),
        meteoraDexAdapter: asClass(MeteoraDexAdapter).singleton(),
        raydiumDexAdapter: asClass(RaydiumDexAdapter).singleton(),
        dexRegistry: asFunction((meteoraDexAdapter: MeteoraDexAdapter, raydiumDexAdapter: RaydiumDexAdapter) => {
            return new DexRegistry([meteoraDexAdapter, raydiumDexAdapter]);
        }).singleton(),
        dexRouter: asClass(DexRouter).singleton(),

        orderRepository: asClass(PrismaOrderRepository).singleton(),
        orderService: asClass(OrderService).singleton(),
        orderExecutor: asClass(OrderExecutor).singleton(),
        
        executeOrderJobProcessor: asClass(ExecuteOrderJobProcessor),
        orderQueue: asFunction(() => new Queue('order_queue')).singleton(),
            
        queueEvents: asValue(new QueueEvents("order_queue"))
    });
}
