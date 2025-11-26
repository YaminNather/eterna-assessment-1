import Fastify from 'fastify';
import FastifyWebsockets from '@fastify/websocket';
import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix';
import { orderRouterPrefix, orderRoutes } from './api/routes/orders/router.js';
import 'bullmq';
import { FastifyAdapter } from '@bull-board/fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { setupBullMQProcessor } from './bullmq_worker.js';
import { logger } from './logger.js';
import { setupDiContainer } from './di_container.js';
import cors from "@fastify/cors";
import 'dotenv/config';
async function main() {
    const fastify = Fastify({
        loggerInstance: logger,
    });
    fastify.register(cors);
    fastify.register(fastifyAwilixPlugin, {
        injectionMode: "CLASSIC",
        disposeOnClose: true,
        disposeOnResponse: true,
        strictBooleanEnforced: true,
    });
    fastify.register(FastifyWebsockets);
    setupDiContainer();
    setupBullMQProcessor();
    const bullMqServerAdapter = new FastifyAdapter();
    bullMqServerAdapter.setBasePath('/admin/queues');
    createBullBoard({
        queues: [new BullMQAdapter(diContainer.resolve('orderQueue'))],
        serverAdapter: bullMqServerAdapter,
    });
    fastify.register(bullMqServerAdapter.registerPlugin(), { prefix: '/admin/queues' });
    fastify.register(orderRoutes, { prefix: orderRouterPrefix });
    fastify.listen({ port: 8080 }, function (err, address) {
        if (err) {
            fastify.log.error({ err }, "Failed to start server");
            process.exit(1);
        }
    });
}
main();
