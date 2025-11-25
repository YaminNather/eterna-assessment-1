# Unit Tests Documentation

## Overview
This project includes comprehensive unit tests for the core domain logic using Jest and ts-jest.

## Test Files

### 1. `src/domain/__tests__/dex_router.test.ts`
Tests for the DexRouter class that finds the best DEX for token swaps.

**Test Coverage:**
- ✅ Returns the quote with the highest output amount
- ✅ Returns null when no quotes are available
- ✅ Handles DEX errors gracefully (expects rejection with Promise.all)
- ✅ Handles multiple quotes from a single DEX
- ✅ Handles timeout for slow DEX responses (10s timeout)
- ✅ Compares quotes correctly when amounts are very close

### 2. `src/domain/__tests__/order_executor.test.ts`
Tests for the OrderExecutor class that executes swap orders.

**Test Coverage:**
- ✅ Successfully executes an order end-to-end
- ✅ Throws ExecuteOrderException when no pool is available
- ✅ Handles routing errors
- ✅ Handles swap transaction errors
- ✅ Handles transaction confirmation errors
- ✅ Logs all stages of execution (routing, building, submitted, confirmed)

### 3. `src/domain/order/__tests__/order.test.ts`
Tests for the Order domain entity.

**Test Coverage:**
- ✅ Creates a new order with pending status
- ✅ Creates an order with all properties via constructor
- ✅ Marks a pending order as confirmed
- ✅ Throws OrderAlreadyCompletedException when order is already confirmed
- ✅ Throws OrderAlreadyCompletedException when trying to confirm a failed order
- ✅ Marks a pending order as failed with different failure reasons
- ✅ Throws OrderAlreadyCompletedException when trying to fail a confirmed order
- ✅ Throws OrderAlreadyCompletedException when trying to fail an already failed order
- ✅ Validates OrderStatus enum values
- ✅ Validates OrderFailureReason enum values
- ✅ Validates OrderAlreadyCompletedException error message

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Results

**Total Tests:** 24 passed
**Test Suites:** 3 passed

**Coverage for Tested Files:**
- `dex_router.ts`: 94.44% statements, 85.71% branches, 100% functions
- `order_executor.ts`: 100% statements, 100% branches, 100% functions
- `order.ts`: 100% statements, 100% branches, 100% functions

## Technologies Used

- **Jest 29.7.0**: Testing framework
- **ts-jest 29.2.5**: TypeScript support for Jest
- **@jest/globals**: Jest global functions and types
- **@types/jest**: TypeScript type definitions for Jest

## Configuration

The Jest configuration is in `jest.config.js` and uses:
- ESM module support for TypeScript
- ts-jest preset for TypeScript transformation
- Node test environment
- Test files pattern: `**/__tests__/**/*.test.ts`
