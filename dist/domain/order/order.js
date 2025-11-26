export class Order {
    constructor(opts) {
        this.id = opts.id;
        this.status = opts.status;
        this.tokenIn = opts.tokenIn;
        this.tokenInDecimal = opts.tokenInDecimal;
        this.tokenOut = opts.tokenOut;
        this.tokenOutDecimal = opts.tokenOutDecimal;
        this.amountIn = opts.amountIn;
        this.transactionHash = opts.transactionHash;
        this.dexId = opts.dexId;
        this.poolId = opts.poolId;
        this.finalAmountIn = opts.finalAmountIn;
        this.finalAmountOut = opts.finalAmountOut;
        this.confirmedAt = opts.confirmedAt;
        this.failureReason = opts.failureReason;
    }
    static create(id, tokenIn, tokenInDecimal, tokenOut, tokenOutDecimal, amountIn) {
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
    markAsConfirmed(transactionHash, dexId, poolId, amountIn, amountOut) {
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
    markAsFailed(failureReason) {
        if (this.status !== OrderStatus.pending) {
            throw new OrderAlreadyCompletedException();
        }
        this.status = OrderStatus.failed;
        this.failureReason = failureReason;
    }
}
export var OrderStatus;
(function (OrderStatus) {
    OrderStatus["pending"] = "pending";
    OrderStatus["confirmed"] = "confirmed";
    OrderStatus["failed"] = "failed";
})(OrderStatus || (OrderStatus = {}));
export var OrderFailureReason;
(function (OrderFailureReason) {
    OrderFailureReason["noPoolsFound"] = "no_pools_found";
    OrderFailureReason["slippage"] = "slippage";
    OrderFailureReason["transactionFailed"] = "transaction_failed";
})(OrderFailureReason || (OrderFailureReason = {}));
export class OrderAlreadyCompletedException extends Error {
    constructor() {
        super("Order has already completed");
    }
}
