import type { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export interface Quote {
    readonly dexId: string;
    readonly poolId: PublicKey;

    readonly inputAmount: BN;
    readonly outputAmount: BN;
    readonly minOutputAmount?: BN;
}