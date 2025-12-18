# Contents

1. [Overview](#eterna-backend-task---solana-dex-order-execution-engine)  
2. [Order Type](#order-type-market-orders)  
   - Market Orders  
   - Extension to Other Order Types  
3. [Architecture](#architecture)  
   - Key Components  
4. [Technology Stack](#technology-stack)  
5. [Setup Instructions](#setup-instructions)  
   - Clone & Install  
   - Environment Configuration  
   - Start Services  
6. [API Documentation](#-api-documentation)  
   - Execute Order  
   - WebSocket Progress Stream  
7. [Testing](#testing)  
8. [Monitoring](#monitoring)  
9. [Deployment](#deployment)  
10. [Postman Collection](#postman-collection)  
11. [Proof of Transaction](#proof-of-transactiontransaction-in-the-video-explanation-as-well)


# Eterna Backend Task - Solana DEX Order Execution Engine 

An order execution engine to place swap orders on real Solana based DEXes like Raydium and Meteora that routes to the best possible pools amongst multiple DEXes for the best value.

**YouTube Link**: https://www.youtube.com/watch?v=bFO-D5ZD4tU

## Order Type: Market Orders

**Why Market Orders?**
The need to route to the best DEXes by comparing the current prices of pools in multiple DEXes makes Market orders a good fit the task. Limit and Sniper orders would require custom services to track pools in DEXes by pooling for information on pools before placing orders.

**Extension to Other Order Types:**
- **Limit Orders**: Add a price monitoring service that polls DEX quotes periodically and triggers execution when the target price is reached
- **Sniper Orders**: Integrate with Solana's account subscription to detect new token launches/migrations and trigger immediate execution

## Architecture

The application's architecture is based on idiomatic way to implement clean Architecture for backend applications. The typical layers and their purpose is listed below:

```
src
│   bullmq_worker.ts
│   di_container.ts
│   logger.ts
│   main.ts
│   prisma.ts
│
├───api                         # API Layer contains all the routes and other Rest API concerns
│   └───routes
│       └───orders
│               execute.ts
│               progress.ts
│               router.ts
│
├───application                 # Application Layer contains orchestration concerns like services and job processors
│   ├───queue_job_processors
│   │       execute_order_job_processor.ts
│   │
│   └───services
│           order_progress_buffer.ts
│           order_service.ts
│
├───domain                      # Domain layer contains domain-related concerns like the DEX interface, order executor, order repository, etc.
│   │   dex_registry.ts
│   │   dex_router.ts
│   │   order_executor.ts
│   │
│   ├───dex                   
│   │       dex.ts
│   │       errors.ts
│   │       quote.ts
│   │
│   ├───order
│   │   │   order.ts
│   │   │   order_repository.ts
│   │   │
│   │   └───__tests__
│   │           order.test.ts
│   │
│   └───__tests__
│           dex_router.test.ts
│           order_executor.test.ts
│
│
├───infrastructure               # Infrastructure layer contains all the infrastructure-related concerns like the implementation for the DEXs, order repository implementations, etc.
│   ├───dexes
│   │       meteora_dex_adapter.ts
│   │       raydium_dex_adapter.ts
│   │
│   └───repositories
│       └───order_repository
│               prisma_order_repository.ts

```

### Key Components
- **DEX**: A flexible DEX interface to allow for a modular system that allows easily extending it with new DEXes. 
- **DEX Router**: Fetches quotes from multiple DEXs and selects the best price
- **Order Executor**: Manages the complete order lifecycle from routing to confirmation
- **Queue System**: BullMQ-based concurrent processing with retry logic
- **WebSocket Streaming**: Real-time order status updates

## Technology Stack
- Runtime and Language - NodeJS and Typescript
- Backend Library - Fastify
- Queue System - BullMQ
- Dependency Injection - Awilix
- Logging: Pino
- Tests - Jest
- Database - PostgreSQL
- ORM - Prisma

## Setup Instructions

### 1. Clone and Install

```bash
git clone https://github.com/YaminNather/eterna-assessment-1.git
cd eterna-assessment-1
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
# Solana Wallet (devnet)
WALLET_SECRET_KEY=your_base58_private_key
WALLET_PUBLIC_KEY=your_public_key

# Database
DATABASE_URL="postgresql://postgres@localhost:5432/postgres"

# Redis
REDIS_URL="redis://127.0.0.1:6379"
```

**Get Devnet SOL**: https://faucet.solana.com


### 4. Start Services

**Development:**
```bash
npm run start:dev
```

**Production:**
```bash
npm run build
npm run start:prod
```

Server runs on `http://localhost:8080`

## 📡 API Documentation
**Note**: Using same POST endpoint request and a same HTTP connection for both placing order and streaming progress deviates from RFC 6455 that is the standard for how Websockets are to be implemented. This use case requires manually handling the TCP connection to implement a custom Upgrade process from POST HTTP connection to Websockets, and is not supported by Websocket libraries, and thus I went with multiple routes instead.

### Execute Order

**Endpoint:** `POST /api/orders/execute`

**Request Body:**
```json
{
  "tokenIn": "So11111111111111111111111111111111111111112",
  "tokenInDecimal": 9,
  "tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "tokenOutDecimal": 6,
  "amountIn": "1000000000"
}
```

**Response:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### WebSocket Progress Stream

**Endpoint:** `GET /api/orders/progress?order_id={orderId}`

**Connection:** Upgrade to WebSocket

**Message Examples:**

```json
// Pending
{"status": "pending"}

// Routing
{"status": "routing"}

// Building
{"status": "building"}

// Submitted
{"status": "submitted"}

// Confirmed
{
  "status": "confirmed",
  "transactionHash": "5j7s...",
  "dexId": "RAYDIUM",
  "poolId": "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
  "finalAmountIn": "1000000000",
  "finalAmountOut": "998500"
}

// Failed
{
  "status": "failed",
  "reason": "slippage",
  "message": "Slippage exceeded tolerance"
}
```

## Testing

### Run Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Coverage

- ✅ DEX Router: Quote comparison and best price selection
- ✅ Order Executor: Complete execution flow with mocked DEXs
- ✅ Repository: Order persistence and retrieval

## Monitoring

### Bull Board Dashboard

Access the queue monitoring dashboard at:
```
{{backend_url}}/admin/queues
```

Features:
- Real-time queue metrics
- Job status tracking
- Failed job inspection
- Retry management

**YouTube Link**: https://www.youtube.com/watch?v=bFO-D5ZD4tU

The demo showcases:
- Submitting concurrent orders
- Queue processing multiple orders simultaneously
- DEX routing decisions in console logs
- WebSocket streaming all status transitions
- Transaction confirmations on Solana Explorer
    
## Deployment

**Live API**: https://eterna-assessment-1.onrender.com

Entire infrastructure(Backend, PostgreSQL database and Redis Queue) on Render.com

## Postman Collection

HTTP Collection: [HTTP Collection](https://me6666-5100.postman.co/workspace/Eterna-Assignments~c5bec6d4-db14-430f-b923-59b446331d6c/collection/14851134-bc9ec120-16f3-4108-a99c-565ea9688969?action=share&creator=14851134)

Websocket collection: [Webscket Collection](https://me6666-5100.postman.co/workspace/Eterna-Assignments~c5bec6d4-db14-430f-b923-59b446331d6c/collection/6923fb7eb2e648c8471e8ee0?action=share&creator=14851134)

Includes:
- Execute order endpoint with sample payloads
- WebSocket connection examples

## Proof of transaction(Transaction in the Video Explanation as well):
![proof.png](https://github.com/YaminNather/eterna-assessment-1/blob/main/images/proof.png)