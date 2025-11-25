import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

export class Order {
    readonly id: string;
    
    status: OrderStatus;

    readonly tokenIn: PublicKey;
    readonly tokenInDecimal: number;
    readonly tokenOut: PublicKey;
    readonly tokenOutDecimal: number;

    amountIn: BN;
    
    transactionHash: string | undefined;
    dexId: string | undefined;
    poolId: PublicKey | undefined;
    finalAmountIn: BN | undefined;
    finalAmountOut: BN | undefined;


    confirmedAt: Date | undefined;
    failureReason: OrderFailureReason | undefined;

    constructor(opts: {
        id: string,
        
        status: OrderStatus,

        tokenIn: PublicKey,
        tokenInDecimal: number,
        tokenOut: PublicKey,
        tokenOutDecimal: number,

        amountIn: BN,
        
        transactionHash: string | undefined,
        dexId: string | undefined,
        poolId: PublicKey | undefined,
        finalAmountIn: BN | undefined,
        finalAmountOut: BN | undefined,

        confirmedAt: Date | undefined,
        failureReason: OrderFailureReason | undefined,
    }) {
        this.id =  opts.id;
        
        this.status =  opts.status;

        this.tokenIn =  opts.tokenIn;
        this.tokenInDecimal =  opts.tokenInDecimal;
        this.tokenOut =  opts.tokenOut;
        this.tokenOutDecimal =  opts.tokenOutDecimal;

        this.amountIn =  opts.amountIn;
        
        this.transactionHash = opts.transactionHash;
        this.dexId =  opts.dexId;
        this.poolId =  opts.poolId;
        this.finalAmountIn = opts.finalAmountIn;
        this.finalAmountOut =  opts.finalAmountOut;


        this.confirmedAt =  opts.confirmedAt;
        this.failureReason =  opts.failureReason;
    }

    static create(id: string, tokenIn: PublicKey, tokenInDecimal: number, tokenOut: PublicKey, tokenOutDecimal: number, amountIn: BN) {
        return new Order({
            id: id,
            
            status: OrderStatus.pending,

            tokenIn: tokenIn,
            tokenInDecimal: tokenInDecimal,
            tokenOut: tokenOut,
            tokenOutDecimal: tokenOutDecimal,

            amountIn: amountIn,
            
            transactionHash: undefined,
            dexId: undefined,
            poolId: undefined,
            finalAmountIn: undefined,
            finalAmountOut: undefined,


            confirmedAt: undefined,
            failureReason: undefined,
        });
    }

    markAsConfirmed(transactionHash: string, dexId: string, poolId: PublicKey, amountIn: BN, amountOut: BN) {
        if (this.status !== OrderStatus.pending) {
            throw new OrderAlreadyCompletedException();
        }
        
        this.transactionHash = transactionHash;
        this.dexId = dexId;
        this.poolId = poolId;
        this.amountIn = amountIn;
        this.finalAmountOut = amountOut;
        
        this.confirmedAt = new Date(Date.now());

        this.status = OrderStatus.confirmed;
    }

    markAsFailed(failureReason: OrderFailureReason) {
        if (this.status !== OrderStatus.pending) {
            throw new OrderAlreadyCompletedException();
        }

        this.status = OrderStatus.failed;
        this.failureReason = failureReason;
    }
}

export enum OrderStatus {
    pending = "pending",
    confirmed = "confirmed",
    failed = "failed",
}

export enum OrderFailureReason {
    noPoolsFound = "no_pools_found",
    slippage = "slippage",
}

export class OrderAlreadyCompletedException extends Error {
    constructor() {
        super("Order has already completed")
    }
}