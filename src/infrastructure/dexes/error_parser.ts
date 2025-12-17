import { SendTransactionError } from "@solana/web3.js";

export function getReadableError(error: any): string {
    if (error instanceof SendTransactionError) {
        return parseLogs(error.logs || []);
    }

    // Check if error message contains logs (sometimes embedded in string)
    if (error.message && error.message.includes("Simulation failed")) {
        // Try to extract logs from message if possible, or just look for keywords
    }

    // If it's a generic Error with a messy message, try to clean it
    return error.message || "Unknown transaction error";
}

function parseLogs(logs: string[]): string {
    if (!logs || logs.length === 0) return "Transaction failed with no logs";

    // Common Solana / Anchor Error Codes
    for (const log of logs) {
        if (log.includes("Slippage tolerance exceeded") || log.includes("0x1771")) {
            return "Slippage Tolerance Exceeded: The price moved unfavorably during transaction execution. Try increasing slippage.";
        }
        if (log.includes("insufficient funds") || log.includes("0x1")) {
            return "Insufficient Funds: You do not have enough SOL or Tokens to complete this transaction.";
        }
        if (log.includes("Account not initialized") || log.includes("0xbc4")) {
            return "Account Not Initialized: The token account does not exist.";
        }
        if (log.includes("custom program error: 0x")) {
            const errorCode = log.match(/custom program error: (0x[0-9a-fA-F]+)/)?.[1];
            return `Transaction failed with DEX error code: ${errorCode}. Check DEX documentation for details.`;
        }
    }

    // Default: return the first error-looking log
    const errorLog = logs.find(l => l.toLowerCase().includes("failed") || l.toLowerCase().includes("error"));
    return errorLog || "Transaction failed during simulation/execution";
}
