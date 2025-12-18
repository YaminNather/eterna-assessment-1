import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Dex, type ConfirmationResult } from "../../domain/dex/dex.js"
import type { Quote } from "../../domain/dex/quote.js";
import { CurveCalculator, Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { getFinalSwapAmounts } from "./utils.js";
import { getReadableError } from "./error_parser.js";
import { Logger } from "pino";
import { SlippageExceededError } from "../../domain/dex/errors.js";

export class RaydiumDexAdapter implements Dex {
    private raydium: Raydium | undefined;

    constructor(
        private readonly connection: Connection,
        private readonly logger: Logger,
    ) { }

    private async getRaydiumInstance(): Promise<Raydium> {
        if (!this.raydium) {
            this.raydium = await Raydium.load({
                connection: this.connection,
                cluster: 'devnet',
                disableFeatureCheck: true,
                disableLoadToken: true,
            });
        }
        return this.raydium;
    }

    async getQuotes(tokenIn: PublicKey, tokenOut: PublicKey, amount: BN): Promise<Quote[]> {
        const raydium = await this.getRaydiumInstance();

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
                tokenIn === pool.mintA,
            );

            // this.logger.error({ swapResult }, "RaydiumDexAdapter.getQuotes");

            const quote: Quote = {
                dexId: this.id,
                poolId: new PublicKey(poolId),

                inputAmount: swapResult.inputAmount,
                outputAmount: swapResult.outputAmount,
            };
            quotes.push(quote);
        }

        return quotes;
    }

    async swap(userPublicKey: PublicKey, userSecretKey: Uint8Array, poolMint: PublicKey, tokenIn: PublicKey, tokenOut: PublicKey, quote: Quote): Promise<string> {
        // For swapping, we need to load with the owner's keypair
        const raydium = await Raydium.load({
            owner: new Keypair({ publicKey: userPublicKey.toBytes(), secretKey: userSecretKey }),
            connection: this.connection,
            cluster: 'devnet',
            disableFeatureCheck: true,
            disableLoadToken: true,
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
            tokenIn.toBase58() === pool.poolInfo.mintA.address,
        );

        try {
            const { execute } = await raydium.cpmm.swap({
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
        } catch (e: any) {
            const readableError = getReadableError(e);
            throw new Error(`Raydium swap failed: ${readableError}`);
        }
    }

    async confirmTransaction(transactionHash: string, tokenIn: PublicKey, tokenOut: PublicKey, owner: PublicKey): Promise<ConfirmationResult> {
        try {
            await this.connection.confirmTransaction(transactionHash, "finalized");
        }
        catch (e) {
            if (typeof e === "object") {
                const err = e as any;
                if (Object.hasOwn(err.InstructionError[1], 'Custom') && err.InstructionError[1].Custom === 6005) {
                    throw new SlippageExceededError({ cause: e });
                }
            }


            throw e;
        }

        return await getFinalSwapAmounts(this.connection, transactionHash, tokenIn, tokenOut, owner);
    }

    get id(): string {
        return 'raydium';
    }
}