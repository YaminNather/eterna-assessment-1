import { describe, it, expect, beforeEach } from '@jest/globals';
import { Order, OrderStatus, OrderFailureReason, OrderAlreadyCompletedException } from '../order.js';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
describe('Order', () => {
    const orderId = 'test-order-123';
    const tokenIn = new PublicKey('So11111111111111111111111111111111111111112');
    const tokenOut = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const tokenInDecimal = 9;
    const tokenOutDecimal = 6;
    const amountIn = new BN(1000000);
    describe('create', () => {
        it('should create a new order with pending status', () => {
            const order = Order.create(orderId, tokenIn, tokenInDecimal, tokenOut, tokenOutDecimal, amountIn);
            expect(order.id).toBe(orderId);
            expect(order.status).toBe(OrderStatus.pending);
            expect(order.tokenIn).toEqual(tokenIn);
            expect(order.tokenInDecimal).toBe(tokenInDecimal);
            expect(order.tokenOut).toEqual(tokenOut);
            expect(order.tokenOutDecimal).toBe(tokenOutDecimal);
            expect(order.amountIn).toEqual(amountIn);
            expect(order.transactionHash).toBeUndefined();
            expect(order.dexId).toBeUndefined();
            expect(order.poolId).toBeUndefined();
            expect(order.finalAmountIn).toBeUndefined();
            expect(order.finalAmountOut).toBeUndefined();
            expect(order.confirmedAt).toBeUndefined();
            expect(order.failureReason).toBeUndefined();
        });
    });
    describe('constructor', () => {
        it('should create an order with all properties', () => {
            const transactionHash = 'tx123hash';
            const dexId = 'raydium';
            const poolId = new PublicKey('11111111111111111111111111111111');
            const finalAmountIn = new BN(1005000);
            const finalAmountOut = new BN(500000);
            const confirmedAt = new Date();
            const order = new Order({
                id: orderId,
                status: OrderStatus.confirmed,
                tokenIn,
                tokenInDecimal,
                tokenOut,
                tokenOutDecimal,
                amountIn,
                transactionHash,
                dexId,
                poolId,
                finalAmountIn,
                finalAmountOut,
                confirmedAt,
                failureReason: undefined,
            });
            expect(order.id).toBe(orderId);
            expect(order.status).toBe(OrderStatus.confirmed);
            expect(order.transactionHash).toBe(transactionHash);
            expect(order.dexId).toBe(dexId);
            expect(order.poolId).toEqual(poolId);
            expect(order.finalAmountIn).toEqual(finalAmountIn);
            expect(order.finalAmountOut).toEqual(finalAmountOut);
            expect(order.confirmedAt).toEqual(confirmedAt);
        });
    });
    describe('markAsConfirmed', () => {
        let order;
        beforeEach(() => {
            order = Order.create(orderId, tokenIn, tokenInDecimal, tokenOut, tokenOutDecimal, amountIn);
        });
        it('should mark a pending order as confirmed', () => {
            const transactionHash = 'tx123hash';
            const dexId = 'raydium';
            const poolId = new PublicKey('11111111111111111111111111111111');
            const finalAmountIn = new BN(1005000);
            const finalAmountOut = new BN(500000);
            const beforeTime = Date.now();
            order.markAsConfirmed(transactionHash, dexId, poolId, finalAmountIn, finalAmountOut);
            const afterTime = Date.now();
            expect(order.status).toBe(OrderStatus.confirmed);
            expect(order.transactionHash).toBe(transactionHash);
            expect(order.dexId).toBe(dexId);
            expect(order.poolId).toEqual(poolId);
            expect(order.amountIn).toEqual(finalAmountIn);
            expect(order.finalAmountOut).toEqual(finalAmountOut);
            expect(order.confirmedAt).toBeDefined();
            expect(order.confirmedAt.getTime()).toBeGreaterThanOrEqual(beforeTime);
            expect(order.confirmedAt.getTime()).toBeLessThanOrEqual(afterTime);
        });
        it('should throw OrderAlreadyCompletedException when order is already confirmed', () => {
            const transactionHash = 'tx123hash';
            const dexId = 'raydium';
            const poolId = new PublicKey('11111111111111111111111111111111');
            const finalAmountIn = new BN(1005000);
            const finalAmountOut = new BN(500000);
            order.markAsConfirmed(transactionHash, dexId, poolId, finalAmountIn, finalAmountOut);
            expect(() => {
                order.markAsConfirmed(transactionHash, dexId, poolId, finalAmountIn, finalAmountOut);
            }).toThrow(OrderAlreadyCompletedException);
        });
        it('should throw OrderAlreadyCompletedException when order is already failed', () => {
            order.markAsFailed(OrderFailureReason.noPoolsFound);
            const transactionHash = 'tx123hash';
            const dexId = 'raydium';
            const poolId = new PublicKey('11111111111111111111111111111111');
            const finalAmountIn = new BN(1005000);
            const finalAmountOut = new BN(500000);
            expect(() => {
                order.markAsConfirmed(transactionHash, dexId, poolId, finalAmountIn, finalAmountOut);
            }).toThrow(OrderAlreadyCompletedException);
        });
    });
    describe('markAsFailed', () => {
        let order;
        beforeEach(() => {
            order = Order.create(orderId, tokenIn, tokenInDecimal, tokenOut, tokenOutDecimal, amountIn);
        });
        it('should mark a pending order as failed with no pools found reason', () => {
            order.markAsFailed(OrderFailureReason.noPoolsFound);
            expect(order.status).toBe(OrderStatus.failed);
            expect(order.failureReason).toBe(OrderFailureReason.noPoolsFound);
        });
        it('should mark a pending order as failed with slippage reason', () => {
            order.markAsFailed(OrderFailureReason.slippage);
            expect(order.status).toBe(OrderStatus.failed);
            expect(order.failureReason).toBe(OrderFailureReason.slippage);
        });
        it('should throw OrderAlreadyCompletedException when order is already confirmed', () => {
            const transactionHash = 'tx123hash';
            const dexId = 'raydium';
            const poolId = new PublicKey('11111111111111111111111111111111');
            const finalAmountIn = new BN(1005000);
            const finalAmountOut = new BN(500000);
            order.markAsConfirmed(transactionHash, dexId, poolId, finalAmountIn, finalAmountOut);
            expect(() => {
                order.markAsFailed(OrderFailureReason.noPoolsFound);
            }).toThrow(OrderAlreadyCompletedException);
        });
        it('should throw OrderAlreadyCompletedException when order is already failed', () => {
            order.markAsFailed(OrderFailureReason.noPoolsFound);
            expect(() => {
                order.markAsFailed(OrderFailureReason.slippage);
            }).toThrow(OrderAlreadyCompletedException);
        });
    });
    describe('OrderStatus enum', () => {
        it('should have correct status values', () => {
            expect(OrderStatus.pending).toBe('pending');
            expect(OrderStatus.confirmed).toBe('confirmed');
            expect(OrderStatus.failed).toBe('failed');
        });
    });
    describe('OrderFailureReason enum', () => {
        it('should have correct failure reason values', () => {
            expect(OrderFailureReason.noPoolsFound).toBe('no_pools_found');
            expect(OrderFailureReason.slippage).toBe('slippage');
        });
    });
    describe('OrderAlreadyCompletedException', () => {
        it('should have correct error message', () => {
            const exception = new OrderAlreadyCompletedException();
            expect(exception.message).toBe('Order has already completed');
            expect(exception).toBeInstanceOf(Error);
        });
    });
});
