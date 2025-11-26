import BN from "bn.js";
export async function getFinalSwapAmounts(connection, txid, inputToken, outputToken) {
    const tx = (await connection.getParsedTransaction(txid, {
        maxSupportedTransactionVersion: 0
    }));
    const findDifference = (token, type) => {
        const preBalanceString = tx.meta.preTokenBalances
            .filter((e) => e.mint === token.toBase58())[0]
            .uiTokenAmount
            .amount;
        const postBalanceString = tx.meta.postTokenBalances
            .filter((e) => e.mint === token.toBase58())[0]
            .uiTokenAmount
            .amount;
        return type == 0
            ? new BN(postBalanceString).sub(new BN(preBalanceString))
            : new BN(preBalanceString).sub(new BN(postBalanceString));
    };
    return {
        amountIn: findDifference(inputToken, 0),
        amountOut: findDifference(outputToken, 0),
    };
}
