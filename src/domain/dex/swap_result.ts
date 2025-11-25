import type BN from "bn.js";

export interface SwapResult {
    outputAmount: BN;
    fees: BN;
    tokenDecimal: BN;
}