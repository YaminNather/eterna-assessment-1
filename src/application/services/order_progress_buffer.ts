import { QueueEvents } from "bullmq";
import type { Logger } from "pino";

interface OrderEvent {
    orderId: string;
    type: 'waiting' | 'progress' | 'completed' | 'failed';
    timestamp: number;
    data: any;
}

export class OrderProgressBuffer {
    private eventBuffer: Map<string, OrderEvent[]> = new Map();
    private readonly maxEventsPerOrder = 100;
    private readonly maxAge = 5 * 60 * 1000; // 5 minutes
    private cleanupInterval: NodeJS.Timeout;

    constructor(
        private readonly logger: Logger,
        private readonly queueEvents: QueueEvents,
    ) {
        this.setupEventListeners();
        
        // Cleanup old events every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }

    private setupEventListeners() {
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

    private extractOrderId(jobId: string): string | null {
        const prefix = 'execute_order_';
        if (jobId.startsWith(prefix)) {
            return jobId.substring(prefix.length);
        }
        return null;
    }

    private addEvent(orderId: string, event: OrderEvent) {
        if (!this.eventBuffer.has(orderId)) {
            this.eventBuffer.set(orderId, []);
        }

        const events = this.eventBuffer.get(orderId)!;
        events.push(event);

        // Limit buffer size per order
        if (events.length > this.maxEventsPerOrder) {
            events.shift();
        }

        this.logger.debug({ orderId, eventType: event.type }, 'Buffered order event');
    }

    public getEvents(orderId: string): OrderEvent[] {
        return this.eventBuffer.get(orderId) || [];
    }

    public clearEvents(orderId: string) {
        this.eventBuffer.delete(orderId);
    }

    private cleanup() {
        const now = Date.now();
        const orderIdsToDelete: string[] = [];

        for (const [orderId, events] of this.eventBuffer.entries()) {
            // Remove events older than maxAge
            const filteredEvents = events.filter(event => now - event.timestamp < this.maxAge);
            
            if (filteredEvents.length === 0) {
                orderIdsToDelete.push(orderId);
            } else if (filteredEvents.length !== events.length) {
                this.eventBuffer.set(orderId, filteredEvents);
            }
        }

        // Delete orders with no events
        orderIdsToDelete.forEach(orderId => this.eventBuffer.delete(orderId));

        if (orderIdsToDelete.length > 0) {
            this.logger.debug({ count: orderIdsToDelete.length }, 'Cleaned up old order events');
        }
    }

    public async close() {
        clearInterval(this.cleanupInterval);
        await this.queueEvents.close();
    }
}
