import { Keypair, PublicKey } from "@solana/web3.js";
import { CurveCalculator, Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { getFinalSwapAmounts } from "./utils.js";
export class RaydiumDexAdapter {
    constructor(connection) {
        this.connection = connection;
    }
    async getQuotes(tokenIn, tokenOut, amount) {
        const raydium = await Raydium.load({
            connection: this.connection,
            cluster: 'devnet',
        });
        const poolsBrief = (await raydium.api.fetchPoolByMints({
            mint1: tokenIn,
            mint2: tokenOut,
        }))
            .data
            .filter((e) => e.type === "Standard");
        const poolIds = poolsBrief.map((e) => e.id);
        const pools = await raydium.cpmm.getRpcPoolInfos(poolIds);
        const quotes = [];
        for (const poolId of poolIds) {
            const pool = pools[poolId];
            const swapResult = CurveCalculator.swapBaseInput(amount, pool.baseReserve, pool.quoteReserve, new BN(25), pool.creatorFeesMintA, pool.protocolFeesMintB, pool.fundFeesMintA, tokenIn === pool.mintA);
            const quote = {
                dexId: this.id,
                poolId: new PublicKey(poolId),
                inputAmount: swapResult.inputAmount,
                inputAmountWithFees: swapResult.inputAmount
                    .add(swapResult.tradeFee)
                    .add(swapResult.fundFee)
                    .add(swapResult.creatorFee)
                    .add(swapResult.protocolFee),
                outputAmount: swapResult.outputAmount,
                minOutputAmount: swapResult.outputAmount,
            };
            quotes.push(quote);
        }
        return quotes;
    }
    async swap(userPublicKey, userSecretKey, poolMint, tokenIn, quote) {
        const raydium = await Raydium.load({
            owner: new Keypair({ publicKey: userPublicKey.toBytes(), secretKey: userSecretKey }),
            connection: this.connection,
            cluster: 'devnet',
        });
        const pool = await raydium.cpmm.getPoolInfoFromRpc(quote.poolId.toBase58());
        const swapResult = CurveCalculator.swapBaseInput(quote.inputAmount, pool.rpcData.baseReserve, pool.rpcData.quoteReserve, new BN(25), pool.rpcData.creatorFeesMintA, pool.rpcData.protocolFeesMintB, pool.rpcData.fundFeesMintA, tokenIn.toBase58() === pool.poolInfo.mintA.address);
        const { execute, transaction } = await raydium.cpmm.swap({
            poolInfo: pool.poolInfo,
            poolKeys: pool.poolKeys,
            inputAmount: quote.inputAmount,
            swapResult,
            slippage: 0.005,
            baseIn: tokenIn.toBase58() === pool.poolInfo.mintA.address,
            txVersion: TxVersion.V0,
        });
        const { txId } = await execute();
        return txId;
    }
    async confirmTransaction(transactionHash, tokenIn, tokenOut) {
        await this.connection.confirmTransaction(transactionHash, "finalized");
        return await getFinalSwapAmounts(this.connection, transactionHash, tokenIn, tokenOut);
    }
    get id() {
        return 'raydium';
    }
}
