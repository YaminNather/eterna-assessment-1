import { QueueEvents } from "bullmq";
import type { FastifyRequest } from "fastify";
import type WebSocket from "ws";

export const progressRoute = '/progress';

export function progressRouteHandler(socket: WebSocket, request: FastifyRequest) {
    const orderId = request.query.order_id;

    const orderEvents = new QueueEvents("order_queue");
    
    orderEvents.on('waiting', ({ jobId, prev }) => {
        if (!isCurrentOrdersJob(jobId, orderId)) {
            return;
        }

        const message = JSON.stringify({
            status: 'pending',
        });
        return socket.send(message);
    });

    orderEvents.on('progress', ({ jobId, data }) => {
        if (!isCurrentOrdersJob(jobId, orderId)) {
            return;
        }
        
        socket.send(JSON.stringify(data));
    });
    
    orderEvents.on('failed', ({ jobId, failedReason }) => {
        if (!isCurrentOrdersJob(jobId, orderId)) {
            return;
        }

        socket.send(failedReason);
        socket.close();
    });

    orderEvents.on('completed', ({ jobId, returnvalue, prev }) => {
        if (!isCurrentOrdersJob(jobId, orderId)) {
            return;
        }

        socket.send(JSON.stringify(returnvalue));
        socket.close();
    });
}

function isCurrentOrdersJob(jobId: string, orderId: string) {
    return jobId === `execute_order_${orderId}`;
}