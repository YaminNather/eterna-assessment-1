export abstract class DexError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
    }
}

export class SlippageExceededError extends DexError {
    constructor(options?: ErrorOptions) {
        super("Slippage exceeded", options);
    }
}