import { diContainer } from "@fastify/awilix";
import { QueueEvents } from "bullmq";
import type { FastifyRequest } from "fastify";
import type WebSocket from "ws";
import type { OrderProgressBuffer } from "../../../application/services/order_progress_buffer.js";

export const progressRoute = '/progress';

export function progressRouteHandler(socket: WebSocket, request: FastifyRequest) {
    const queueEvents = diContainer.resolve<QueueEvents>("queueEvents");
    const orderProgressBuffer = diContainer.resolve<OrderProgressBuffer>('orderProgressBuffer');

    const orderId = (request.query as { order_id?: string }).order_id as string;
    
    // First, send all buffered events for this order
    const bufferedEvents = orderProgressBuffer.getEvents(orderId);
    if (bufferedEvents.length > 0) {
        request.log.info({ orderId, count: bufferedEvents.length }, 'Sending buffered events');
        
        for (const event of bufferedEvents) {
            try {
                if (event.type === 'failed') {
                    socket.send(event.data);
                } else {
                    socket.send(JSON.stringify(event.data));
                }
            } catch (err) {
                request.log.error({ orderId, err }, 'Failed to send buffered event');
            }
        }
    }
    
    // Now listen for new events
    queueEvents.on('waiting', ({ jobId }) => {
        if (!isCurrentOrdersJob(jobId, orderId)) {
            return;
        }

        const message = JSON.stringify({
            status: 'pending',
        });
        return socket.send(message);
    });

    queueEvents.on('progress', ({ jobId, data }) => {
        if (!isCurrentOrdersJob(jobId, orderId)) {
            return;
        }
        
        socket.send(JSON.stringify(data));
    });
    
    queueEvents.on('failed', ({ jobId, failedReason }) => {
        if (!isCurrentOrdersJob(jobId, orderId)) {
            return;
        }

        socket.send(failedReason);
        socket.close();
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
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