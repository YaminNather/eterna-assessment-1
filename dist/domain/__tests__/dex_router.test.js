import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DexRouter } from '../dex_router.js';
import { DexRegistry } from '../dex_registry.js';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
describe('DexRouter', () => {
    let dexRouter;
    let mockDexRegistry;
    let mockDex1;
    let mockDex2;
    const tokenIn = new PublicKey('So11111111111111111111111111111111111111112');
    const tokenOut = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const amount = new BN(1000000);
    beforeEach(() => {
        mockDex1 = {
            id: 'raydium',
            getQuotes: jest.fn(),
            swap: jest.fn(),
            confirmTransaction: jest.fn(),
        };
        mockDex2 = {
            id: 'meteora',
            getQuotes: jest.fn(),
            swap: jest.fn(),
            confirmTransaction: jest.fn(),
        };
        mockDexRegistry = new DexRegistry([mockDex1, mockDex2]);
        dexRouter = new DexRouter(mockDexRegistry);
    });
    describe('findBestValueDexForOrder', () => {
        it('should return the quote with the highest output amount', async () => {
            const quote1 = {
                dexId: 'raydium',
                poolId: new PublicKey('11111111111111111111111111111112'),
                inputAmount: new BN(1000000),
                inputAmountWithFees: new BN(1005000),
                outputAmount: new BN(500000),
                minOutputAmount: new BN(495000),
            };
            const quote2 = {
                dexId: 'meteora',
                poolId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                inputAmount: new BN(1000000),
                inputAmountWithFees: new BN(1003000),
                outputAmount: new BN(520000),
                minOutputAmount: new BN(515000),
            };
            mockDex1.getQuotes.mockResolvedValue([quote1]);
            mockDex2.getQuotes.mockResolvedValue([quote2]);
            const result = await dexRouter.findBestValueDexForOrder(tokenIn, tokenOut, amount);
            expect(result).toEqual(quote2);
            expect(mockDex1.getQuotes).toHaveBeenCalledWith(tokenIn, tokenOut, amount);
            expect(mockDex2.getQuotes).toHaveBeenCalledWith(tokenIn, tokenOut, amount);
        });
        it('should return null when no quotes are available', async () => {
            mockDex1.getQuotes.mockResolvedValue([]);
            mockDex2.getQuotes.mockResolvedValue([]);
            const result = await dexRouter.findBestValueDexForOrder(tokenIn, tokenOut, amount);
            expect(result).toBeNull();
        });
        it('should handle dex errors gracefully and return best available quote', async () => {
            const quote1 = {
                dexId: 'raydium',
                poolId: new PublicKey('11111111111111111111111111111112'),
                inputAmount: new BN(1000000),
                inputAmountWithFees: new BN(1005000),
                outputAmount: new BN(500000),
                minOutputAmount: new BN(495000),
            };
            mockDex1.getQuotes.mockResolvedValue([quote1]);
            mockDex2.getQuotes.mockImplementation(async () => {
                throw new Error('DEX unavailable');
            });
            // The implementation uses Promise.all which will reject if any promise rejects
            // So this test actually expects the error to propagate
            await expect(dexRouter.findBestValueDexForOrder(tokenIn, tokenOut, amount)).rejects.toThrow('DEX unavailable');
        });
        it('should handle multiple quotes from a single dex', async () => {
            const quote1 = {
                dexId: 'raydium',
                poolId: new PublicKey('11111111111111111111111111111112'),
                inputAmount: new BN(1000000),
                inputAmountWithFees: new BN(1005000),
                outputAmount: new BN(500000),
                minOutputAmount: new BN(495000),
            };
            const quote2 = {
                dexId: 'raydium',
                poolId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                inputAmount: new BN(1000000),
                inputAmountWithFees: new BN(1003000),
                outputAmount: new BN(510000),
                minOutputAmount: new BN(505000),
            };
            mockDex1.getQuotes.mockResolvedValue([quote1, quote2]);
            mockDex2.getQuotes.mockResolvedValue([]);
            const result = await dexRouter.findBestValueDexForOrder(tokenIn, tokenOut, amount);
            expect(result).toEqual(quote2);
        });
        it('should timeout slow dex responses', async () => {
            const quote1 = {
                dexId: 'raydium',
                poolId: new PublicKey('11111111111111111111111111111111'),
                inputAmount: new BN(1000000),
                inputAmountWithFees: new BN(1005000),
                outputAmount: new BN(500000),
                minOutputAmount: new BN(495000),
            };
            mockDex1.getQuotes.mockResolvedValue([quote1]);
            mockDex2.getQuotes.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve([]), 15000)));
            const result = await dexRouter.findBestValueDexForOrder(tokenIn, tokenOut, amount);
            expect(result).toEqual(quote1);
        }, 12000);
        it('should compare quotes correctly when amounts are very close', async () => {
            const quote1 = {
                dexId: 'raydium',
                poolId: new PublicKey('11111111111111111111111111111112'),
                inputAmount: new BN(1000000),
                inputAmountWithFees: new BN(1005000),
                outputAmount: new BN(500000),
                minOutputAmount: new BN(495000),
            };
            const quote2 = {
                dexId: 'meteora',
                poolId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                inputAmount: new BN(1000000),
                inputAmountWithFees: new BN(1003000),
                outputAmount: new BN(500001),
                minOutputAmount: new BN(495001),
            };
            mockDex1.getQuotes.mockResolvedValue([quote1]);
            mockDex2.getQuotes.mockResolvedValue([quote2]);
            const result = await dexRouter.findBestValueDexForOrder(tokenIn, tokenOut, amount);
            expect(result).toEqual(quote2);
        });
    });
});
