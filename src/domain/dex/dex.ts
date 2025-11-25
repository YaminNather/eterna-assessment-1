import type { PublicKey } from "@solana/web3.js";
import type { Quote } from "./quote.js";
import type BN from "bn.js";

export abstract class Dex {
    abstract get id(): string
    
    abstract getQuotes(tokenIn: PublicKey, tokenOut: PublicKey, amount: BN): Promise<Quote[]>
    
    abstract swap(userPublicKey: PublicKey, userSecretKey: Uint8Array, poolMint: PublicKey, tokenIn: PublicKey, quote: Quote): Promise<string>
    
    abstract confirmTransaction(transactionHash: string, tokenIn: PublicKey, tokenOut: PublicKey): Promise<ConfirmationResult>
}

export interface ConfirmationResult {
    readonly amountIn: BN;
    readonly amountOut: BN;
}