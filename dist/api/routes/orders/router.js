import { executeRoute, executeRouteHandler } from './execute.js';
import { progressRoute, progressRouteHandler } from './progress.js';
export async function orderRoutes(fastify, options) {
    fastify.post(executeRoute, executeRouteHandler);
    fastify.get(progressRoute, { websocket: true }, progressRouteHandler);
}
export const orderRouterPrefix = '/api/orders';
