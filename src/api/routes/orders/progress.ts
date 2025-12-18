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

    const isCurrentOrdersJob = (jobId: string) => jobId === `execute_order_${orderId}`;

    const onWaiting = ({ jobId }: { jobId: string }) => {
        if (!isCurrentOrdersJob(jobId)) return;
        const message = JSON.stringify({
            status: 'pending',
        });
        socket.send(message);
    };

    const onProgress = ({ jobId, data }: { jobId: string; data: any }) => {
        if (!isCurrentOrdersJob(jobId)) return;
        socket.send(JSON.stringify(data));
    };

    const onFailed = ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
        if (!isCurrentOrdersJob(jobId)) return;
        socket.send(failedReason);
        socket.close();
        cleanup();
    };

    const onCompleted = ({ jobId, returnvalue }: { jobId: string; returnvalue: any }) => {
        if (!isCurrentOrdersJob(jobId)) return;
        socket.send(JSON.stringify(returnvalue));
        socket.close();
        cleanup();
    };

    const cleanup = () => {
        queueEvents.off('waiting', onWaiting);
        queueEvents.off('progress', onProgress);
        queueEvents.off('failed', onFailed);
        queueEvents.off('completed', onCompleted);
    };

    queueEvents.on('waiting', onWaiting);
    queueEvents.on('progress', onProgress);
    queueEvents.on('failed', onFailed);
    queueEvents.on('completed', onCompleted);

    socket.on('close', cleanup);
    socket.on('error', cleanup);
}