import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Dex, type ConfirmationResult } from "../../domain/dex/dex.js"
import type { Quote } from "../../domain/dex/quote.js";
import { CurveCalculator, Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { getFinalSwapAmounts } from "./utils.js";

export class RaydiumDexAdapter implements Dex {
    constructor(
        private readonly connection: Connection,
    ) {}

    async getQuotes(tokenIn: PublicKey, tokenOut: PublicKey, amount: BN): Promise<Quote[]> {
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

        const quotes: Quote[] = [];
        for (const poolId of poolIds) {
            const pool = pools[poolId]!;

            const swapResult = CurveCalculator.swapBaseInput(
                amount,
                pool.baseReserve,
                pool.quoteReserve,
                new BN(25),
                pool.creatorFeesMintA,
                pool.protocolFeesMintB,
                pool.fundFeesMintA,
                false,
            );
            
            const quote: Quote = {
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
    
    async swap(userPublicKey: PublicKey, userSecretKey: Uint8Array, poolMint: PublicKey, tokenIn: PublicKey, quote: Quote): Promise<string> {
        const raydium = await Raydium.load({
            owner: new Keypair({ publicKey: userPublicKey.toBytes(), secretKey: userSecretKey }),
            connection: this.connection,
            cluster: 'devnet',
        });

        const pool = await raydium.cpmm.getPoolInfoFromRpc(quote.poolId.toBase58());

        const swapResult = CurveCalculator.swapBaseInput(
            quote.inputAmount,
            pool.rpcData.baseReserve,
            pool.rpcData.quoteReserve,
            new BN(25),
            pool.rpcData.creatorFeesMintA,
            pool.rpcData.protocolFeesMintB,
            pool.rpcData.fundFeesMintA,
            false,
        );

        const { execute, transaction } = await raydium.cpmm.swap({
            poolInfo: pool.poolInfo,
            poolKeys: pool.poolKeys,
            inputAmount: quote.inputAmount,
            swapResult,
            slippage: 0.005,
            baseIn: true,

            txVersion: TxVersion.V0,
        });
        
        const { txId } = await execute();
        
        return txId;
    }

    async confirmTransaction(transactionHash: string, tokenIn: PublicKey, tokenOut: PublicKey): Promise<ConfirmationResult> {
        await this.connection.confirmTransaction(transactionHash, "finalized");
        
        return await getFinalSwapAmounts(this.connection, transactionHash, tokenIn, tokenOut);
    }

    get id(): string {
        return 'raydium';
    }
}