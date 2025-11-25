import type { PublicKey } from "@solana/web3.js";
import { wait } from "../utils/promise_utils.js";
import type { Quote } from "./dex/quote.js";
import type { DexRegistry } from "./dex_registry.js";
import type BN from "bn.js";

export class DexRouter {
    private static readonly FETCH_QUOTES_TIMEOUT = 10 * 1000;

    constructor(
        private readonly dexRegistry: DexRegistry,
    ) {}

    async findBestValueDexForOrder(tokenIn: PublicKey, tokenOut: PublicKey, amount: BN): Promise<Quote | null> {
        const quotePromises = this.dexRegistry.dexes.map((dex) => {
            return Promise.race([
                wait(DexRouter.FETCH_QUOTES_TIMEOUT),
                dex.getQuotes(tokenIn, tokenOut, amount),
            ]);
        });
        let fetchQuotesResult: (Quote[] | void | Error)[] = await Promise.all(quotePromises);
        const quotes: Quote[] = fetchQuotesResult
            .filter((e) => e !== undefined && !(e instanceof Error))
            .flat() as Quote[];
            
        if (quotes.length === 0) {
            return null;
        }

        let maxQuoteIndex: number = 0;
        for (let i = 1; i < quotes.length; ++i) {
            const quote = quotes[i];

            if (!quote || quote instanceof Error) {
                continue;
            }

            if (quote.outputAmount.gt(quotes[maxQuoteIndex]!.outputAmount)) {
                maxQuoteIndex = i;
            }
        }

        // if (maxQuoteIndex === -1) {
        //     throw new NoDexAvailableException();
        // }

        return quotes[maxQuoteIndex]!;
    }
}