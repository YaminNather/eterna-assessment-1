import { diContainer } from "@fastify/awilix";
export const progressRoute = '/progress';
export function progressRouteHandler(socket, request) {
    const queueEvents = diContainer.resolve("queueEvents");
    const orderProgressBuffer = diContainer.resolve('orderProgressBuffer');
    const orderId = request.query.order_id;
    const bufferedEvents = orderProgressBuffer.getEvents(orderId);
    if (bufferedEvents.length > 0) {
        request.log.info({ orderId, count: bufferedEvents.length }, 'Sending buffered events');
        for (const event of bufferedEvents) {
            try {
                if (event.type === 'failed') {
                    socket.send(event.data);
                }
                else {
                    socket.send(JSON.stringify(event.data));
                }
            }
            catch (err) {
                request.log.error({ orderId, err }, 'Failed to send buffered event');
            }
        }
    }
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
function isCurrentOrdersJob(jobId, orderId) {
    return jobId === `execute_order_${orderId}`;
}
