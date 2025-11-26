import { diContainer } from '@fastify/awilix';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
export async function setupBullMQProcessor() {
    const redisConnection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    new Worker('order_queue', async (job) => {
        const logger = diContainer.resolve('logger');
        try {
            switch (job.name) {
                case 'execute_order':
                    const jobProcessor = diContainer.resolve('executeOrderJobProcessor');
                    return jobProcessor.executeOrder(job);
            }
        }
        catch (e) {
            logger.error({ job_id: job.id, job_name: job.name, err: e }, "Job failed");
            throw e;
        }
    }, { connection: redisConnection, concurrency: 20 });
}
