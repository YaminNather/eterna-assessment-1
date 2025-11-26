import { QueueEvents } from "bullmq";
export class OrderProgressBuffer {
    constructor(logger) {
        this.logger = logger;
        this.eventBuffer = new Map();
        this.maxEventsPerOrder = 100;
        this.maxAge = 5 * 60 * 1000; // 5 minutes
        this.queueEvents = new QueueEvents("order_queue");
        this.setupEventListeners();
        // Cleanup old events every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }
    setupEventListeners() {
        this.queueEvents.on('waiting', ({ jobId, prev }) => {
            const orderId = this.extractOrderId(jobId);
            if (orderId) {
                this.addEvent(orderId, {
                    orderId,
                    type: 'waiting',
                    timestamp: Date.now(),
                    data: { status: 'pending' }
                });
            }
        });
        this.queueEvents.on('progress', ({ jobId, data }) => {
            const orderId = this.extractOrderId(jobId);
            if (orderId) {
                this.addEvent(orderId, {
                    orderId,
                    type: 'progress',
                    timestamp: Date.now(),
                    data
                });
            }
        });
        this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
            const orderId = this.extractOrderId(jobId);
            if (orderId) {
                this.addEvent(orderId, {
                    orderId,
                    type: 'completed',
                    timestamp: Date.now(),
                    data: returnvalue
                });
            }
        });
        this.queueEvents.on('failed', ({ jobId, failedReason }) => {
            const orderId = this.extractOrderId(jobId);
            if (orderId) {
                this.addEvent(orderId, {
                    orderId,
                    type: 'failed',
                    timestamp: Date.now(),
                    data: failedReason
                });
            }
        });
    }
    extractOrderId(jobId) {
        const prefix = 'execute_order_';
        if (jobId.startsWith(prefix)) {
            return jobId.substring(prefix.length);
        }
        return null;
    }
    addEvent(orderId, event) {
        if (!this.eventBuffer.has(orderId)) {
            this.eventBuffer.set(orderId, []);
        }
        const events = this.eventBuffer.get(orderId);
        events.push(event);
        // Limit buffer size per order
        if (events.length > this.maxEventsPerOrder) {
            events.shift();
        }
        this.logger.debug({ orderId, eventType: event.type }, 'Buffered order event');
    }
    getEvents(orderId) {
        return this.eventBuffer.get(orderId) || [];
    }
    clearEvents(orderId) {
        this.eventBuffer.delete(orderId);
    }
    cleanup() {
        const now = Date.now();
        const orderIdsToDelete = [];
        for (const [orderId, events] of this.eventBuffer.entries()) {
            // Remove events older than maxAge
            const filteredEvents = events.filter(event => now - event.timestamp < this.maxAge);
            if (filteredEvents.length === 0) {
                orderIdsToDelete.push(orderId);
            }
            else if (filteredEvents.length !== events.length) {
                this.eventBuffer.set(orderId, filteredEvents);
            }
        }
        // Delete orders with no events
        orderIdsToDelete.forEach(orderId => this.eventBuffer.delete(orderId));
        if (orderIdsToDelete.length > 0) {
            this.logger.debug({ count: orderIdsToDelete.length }, 'Cleaned up old order events');
        }
    }
    async close() {
        clearInterval(this.cleanupInterval);
        await this.queueEvents.close();
    }
}
