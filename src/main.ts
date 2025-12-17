import Fastify from 'fastify';
import FastifyWebsockets from '@fastify/websocket';

import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix';
import { orderRouterPrefix, orderRoutes } from './api/routes/orders/router.js';
import { Queue } from 'bullmq';

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

    // Eagerly resolve orderProgressBuffer to start listening to events immediately
    diContainer.resolve('orderProgressBuffer');

    setupBullMQProcessor();

    const bullMqServerAdapter = new FastifyAdapter();
    bullMqServerAdapter.setBasePath('/admin/queues');
    createBullBoard({
        queues: [new BullMQAdapter(diContainer.resolve<Queue>('orderQueue'))],
        serverAdapter: bullMqServerAdapter,
    });
    fastify.register(bullMqServerAdapter.registerPlugin(), { prefix: '/admin/queues' });

    fastify.register(orderRoutes, { prefix: orderRouterPrefix });

    const port = process.env.PORT !== undefined ? parseInt(process.env.PORT as string) : 8080;
    fastify.listen({ port: port, host: "0.0.0.0", }, function (err, address) {
        if (err) {
            fastify.log.error({ err }, "Failed to start server");
            process.exit(1);
        }
    });
}

main();