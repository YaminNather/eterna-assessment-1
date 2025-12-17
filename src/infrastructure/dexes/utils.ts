import type { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export async function getFinalSwapAmounts(connection: Connection, txid: string, inputToken: PublicKey, outputToken: PublicKey, owner: PublicKey) {
  const tx = (await connection.getParsedTransaction(txid, {
    maxSupportedTransactionVersion: 0
  }))!;

  if (!tx || !tx.meta) throw new Error("Transaction not found or missing meta");

  // Helper for Native SOL
  const isNativeSol = (mint: PublicKey) => mint.toBase58() === "So11111111111111111111111111111111111111112";

  const findDifference = (token: PublicKey, type: 'input' | 'output') => {
    // 1. Handle Native SOL
    if (isNativeSol(token)) {
      const accountIndex = tx.transaction.message.accountKeys.findIndex(
        key => key.pubkey.equals(owner)
      );
      if (accountIndex === -1) return new BN(0);

      const preBalance = new BN(tx.meta!.preBalances[accountIndex] || 0);
      const postBalance = new BN(tx.meta!.postBalances[accountIndex] || 0);

      // Input: Pre > Post. Output: Post > Pre.
      // Note: This includes gas fees for input SOL.
      return type === 'output'
        ? postBalance.sub(preBalance)
        : preBalance.sub(postBalance);
    }

    // 2. Handle SPL Tokens
    // Find the specific token account owned by 'owner'
    const findBalance = (balances: any[]) => {
      // preTokenBalances/postTokenBalances items have { mint, owner, uiTokenAmount, ... }
      const balance = balances.find(e =>
        e.mint === token.toBase58() && e.owner === owner.toBase58()
      );
      return balance ? new BN(balance.uiTokenAmount.amount) : new BN(0);
    };

    const preBalance = findBalance(tx.meta!.preTokenBalances || []);
    const postBalance = findBalance(tx.meta!.postTokenBalances || []);

    return type === 'output'
      ? postBalance.sub(preBalance)
      : preBalance.sub(postBalance);
  }

  return {
    amountIn: findDifference(inputToken, 'input').abs(),
    amountOut: findDifference(outputToken, 'output').abs(),
  }
}