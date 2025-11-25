import { type FastifyInstance, type FastifyPluginOptions} from 'fastify';
import { executeRoute, executeRouteHandler } from './execute.js';
import { progressRoute, progressRouteHandler } from './progress.js';

export async function orderRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    fastify.post(executeRoute, executeRouteHandler);
    fastify.get(progressRoute, { websocket: true }, progressRouteHandler);
}

export const orderRouterPrefix = '/api/orders';