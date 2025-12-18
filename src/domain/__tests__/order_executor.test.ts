import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { OrderExecutor, ExecuteOrderStatus, ExecuteOrderException, NoPoolAvailableException, TransactionFailedException, SlippageExceededException } from '../order_executor.js';
import { DexRouter } from '../dex_router.js';
import { DexRegistry } from '../dex_registry.js';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import type { Dex, ConfirmationResult } from '../dex/dex.js';
import type { Quote } from '../dex/quote.js';
import type { Logger } from 'pino';

// Mock the infrastructure dependency to avoid module resolution issues
jest.mock('../../infrastructure/dexes/error_parser.js', () => ({
  getReadableError: () => 'Mock readable error',
}));

describe('OrderExecutor', () => {
  let orderExecutor: OrderExecutor;
  let mockDexRegistry: jest.Mocked<DexRegistry>;
  let mockDexRouter: jest.Mocked<DexRouter>;
  let mockLogger: jest.Mocked<Logger>;
  let mockDex: jest.Mocked<Dex>;
  let progressCallback: jest.Mock;

  const orderId = 'test-order-123';
  const tokenIn = new PublicKey('So11111111111111111111111111111111111111112');
  const tokenOut = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  const amount = new BN(1000000);

  beforeEach(() => {
    process.env.WALLET_PUBLIC_KEY = 'So11111111111111111111111111111111111111112';
    process.env.WALLET_SECRET_KEY = '3q3ForProcessEnvMocking'; // Simple valid bs58 string setup

    mockDex = {
      id: 'raydium',
      getQuotes: jest.fn(),
      swap: jest.fn(),
      confirmTransaction: jest.fn(),
    } as unknown as jest.Mocked<Dex>;

    mockDexRegistry = {
      dexes: [mockDex],
      withId: jest.fn().mockReturnValue(mockDex),
    } as unknown as jest.Mocked<DexRegistry>;

    mockDexRouter = {
      findBestValueDexForOrder: jest.fn(),
    } as unknown as jest.Mocked<DexRouter>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    progressCallback = jest.fn();

    orderExecutor = new OrderExecutor(mockDexRegistry, mockDexRouter, mockLogger);
  });

  describe('executeOrder', () => {
    it('should successfully execute an order', async () => {
      const quote: Quote = {
        dexId: 'raydium',
        poolId: new PublicKey('11111111111111111111111111111111'),
        inputAmount: new BN(1000000),
        outputAmount: new BN(500000),
        minOutputAmount: new BN(495000),
      };

      const transactionHash = 'tx123hash';
      const confirmationResult: ConfirmationResult = {
        amountIn: new BN(1005000),
        amountOut: new BN(498000),
      };

      mockDexRouter.findBestValueDexForOrder.mockResolvedValue(quote);
      mockDex.swap.mockResolvedValue(transactionHash);
      mockDex.confirmTransaction.mockResolvedValue(confirmationResult);

      const result = await orderExecutor.executeOrder(
        orderId,
        tokenIn,
        tokenOut,
        amount,
        progressCallback
      );

      expect(result).toEqual({
        dexId: 'raydium',
        poolId: quote.poolId,
        transactionHash,
        amountIn: confirmationResult.amountIn,
        amountOut: confirmationResult.amountOut,
      });

      expect(progressCallback).toHaveBeenCalledWith(ExecuteOrderStatus.routing);
      expect(progressCallback).toHaveBeenCalledWith(ExecuteOrderStatus.building);
      expect(progressCallback).toHaveBeenCalledWith(ExecuteOrderStatus.submitted);
      expect(progressCallback).toHaveBeenCalledTimes(3);

      expect(mockDexRouter.findBestValueDexForOrder).toHaveBeenCalledWith(
        tokenIn,
        tokenOut,
        amount
      );
      expect(mockDex.swap).toHaveBeenCalled();
      expect(mockDex.confirmTransaction).toHaveBeenCalledWith(
        transactionHash,
        tokenIn,
        tokenOut,
        expect.any(PublicKey) // Owner/Payer
      );
    });

    it('should throw NoPoolAvailableException when no pool is available', async () => {
      mockDexRouter.findBestValueDexForOrder.mockResolvedValue(null);

      await expect(
        orderExecutor.executeOrder(orderId, tokenIn, tokenOut, amount, progressCallback)
      ).rejects.toThrow(NoPoolAvailableException);

      expect(progressCallback).toHaveBeenCalledWith(ExecuteOrderStatus.routing);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should wrap routing errors in TransactionFailedException', async () => {
      const error = new Error('Routing failed');
      mockDexRouter.findBestValueDexForOrder.mockRejectedValue(error);

      await expect(
        orderExecutor.executeOrder(orderId, tokenIn, tokenOut, amount, progressCallback)
      ).rejects.toThrow(TransactionFailedException);
    });

    it('should wrap swap transaction errors in TransactionFailedException', async () => {
      const quote: Quote = {
        dexId: 'raydium',
        poolId: new PublicKey('11111111111111111111111111111111'),
        inputAmount: new BN(1000000),
        outputAmount: new BN(500000),
        minOutputAmount: new BN(495000),
      };

      const swapError = new Error('Swap failed');
      mockDexRouter.findBestValueDexForOrder.mockResolvedValue(quote);
      mockDex.swap.mockRejectedValue(swapError);

      await expect(
        orderExecutor.executeOrder(orderId, tokenIn, tokenOut, amount, progressCallback)
      ).rejects.toThrow(TransactionFailedException);

      expect(progressCallback).toHaveBeenCalledWith(ExecuteOrderStatus.routing);
      expect(progressCallback).toHaveBeenCalledWith(ExecuteOrderStatus.building);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle transaction confirmation errors (wrapped in TransactionFailedException)', async () => {
      const quote: Quote = {
        dexId: 'raydium',
        poolId: new PublicKey('11111111111111111111111111111111'),
        inputAmount: new BN(1000000),
        outputAmount: new BN(500000),
        minOutputAmount: new BN(495000),
      };

      const transactionHash = 'tx123hash';
      // Mocks usually throw standard Error, OrderExecutor wraps it.
      const confirmError = new Error('Confirmation failed');

      mockDexRouter.findBestValueDexForOrder.mockResolvedValue(quote);
      mockDex.swap.mockResolvedValue(transactionHash);
      mockDex.confirmTransaction.mockRejectedValue(confirmError);

      await expect(
        orderExecutor.executeOrder(orderId, tokenIn, tokenOut, amount, progressCallback)
      ).rejects.toThrow(TransactionFailedException);

      expect(progressCallback).toHaveBeenCalledWith(ExecuteOrderStatus.submitted);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
