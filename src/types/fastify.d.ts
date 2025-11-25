import type { WebSocket } from "ws";

declare module "fastify" {
    interface FastifyRequest {
        socket: WebSocket;
    }
}