import { diContainer } from '@fastify/awilix';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import type { Logger } from 'pino';
import type { ExecuteOrderJobProcessor } from './application/queue_job_processors/execute_order_job_processor.js';

export async function setupBullMQProcessor(): Promise<void> {
    const redisConnection = diContainer.resolve<Redis>("redis");
    
    new Worker(
        'order_queue', 
        async job => {
            const logger = diContainer.resolve<Logger>('logger');

            try {
                switch (job.name) {
                    case 'execute_order':
                        const jobProcessor = diContainer.resolve<ExecuteOrderJobProcessor>('executeOrderJobProcessor');
                        return jobProcessor.executeOrder(job);
                }
            }
            catch (e) {
                logger.error({ job_id: job.id, job_name: job.name, err: e }, "Job failed");
                throw e;
            }
        },
        { 
            connection: redisConnection, 
            concurrency: 20, 

            lockDuration: 120000,
            lockRenewTime: 30000,
         },
    );
}