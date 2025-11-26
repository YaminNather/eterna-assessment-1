import { wait } from "../utils/promise_utils.js";
export class DexRouter {
    constructor(dexRegistry) {
        this.dexRegistry = dexRegistry;
    }
    async findBestValueDexForOrder(tokenIn, tokenOut, amount) {
        const quotePromises = this.dexRegistry.dexes.map((dex) => {
            return Promise.race([
                wait(DexRouter.FETCH_QUOTES_TIMEOUT),
                dex.getQuotes(tokenIn, tokenOut, amount),
            ]);
        });
        let fetchQuotesResult = await Promise.all(quotePromises);
        const quotes = fetchQuotesResult
            .filter((e) => e !== undefined && !(e instanceof Error))
            .flat();
        if (quotes.length === 0) {
            return null;
        }
        let maxQuoteIndex = 0;
        for (let i = 1; i < quotes.length; ++i) {
            const quote = quotes[i];
            if (!quote || quote instanceof Error) {
                continue;
            }
            if (quote.outputAmount.gt(quotes[maxQuoteIndex].outputAmount)) {
                maxQuoteIndex = i;
            }
        }
        // if (maxQuoteIndex === -1) {
        //     throw new NoDexAvailableException();
        // }
        return quotes[maxQuoteIndex];
    }
}
DexRouter.FETCH_QUOTES_TIMEOUT = 10 * 1000;
