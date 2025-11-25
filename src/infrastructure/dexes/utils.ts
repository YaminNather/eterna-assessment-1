import type { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export async function getFinalSwapAmounts(connection: Connection, txid: string, inputToken: PublicKey, outputToken: PublicKey) {
  const tx = (await connection.getParsedTransaction(txid, {
    maxSupportedTransactionVersion: 0
  }))!;
  
  const findDifference = (token: PublicKey, type: number) => {
    const preBalanceString = tx.meta!.preTokenBalances!
      .filter((e) => e.mint === token.toBase58())[0]!
      .uiTokenAmount
      .amount!;

    const postBalanceString = tx.meta!.postTokenBalances!
      .filter((e) => e.mint === token.toBase58())[0]!
      .uiTokenAmount
      .amount!;

    return type == 0 
      ? new BN(postBalanceString).sub(new BN(preBalanceString))
      : new BN(preBalanceString).sub(new BN(postBalanceString));
  }

  return {
    amountIn: findDifference(inputToken, 0),
    amountOut: findDifference(outputToken, 0),
  }
}