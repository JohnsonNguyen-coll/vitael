import { z } from "zod";

const chainEnum = z.enum(["sepolia", "arbitrumSepolia", "baseSepolia", "polygonAmoy", "avalancheFuji", "optimismSepolia", "arcTestnet"]);

export const GetMarketsSchema = z.object({ chain: chainEnum });
export const GetPoolsSchema = z.object({ chain: chainEnum });
export const GetAPRSchema = z.object({ chain: chainEnum, asset: z.string() });
export const GetPositionSchema = z.object({ chain: chainEnum, userAddress: z.string() });
export const GetHealthFactorSchema = z.object({ chain: chainEnum, userAddress: z.string() });

export const QuoteSwapSchema = z.object({ chain: chainEnum, amountIn: z.string(), path: z.array(z.string()) });
export const QuoteBridgeSchema = z.object({ fromChain: chainEnum, toChain: chainEnum, amount: z.string() });
export const QuoteAddLiquiditySchema = z.object({ chain: chainEnum, tokenA: z.string(), tokenB: z.string(), amountA: z.string() });

export const DepositSchema = z.object({ chain: chainEnum, asset: z.string(), amount: z.string(), onBehalfOf: z.string() });
export const WithdrawSchema = z.object({ chain: chainEnum, asset: z.string(), amount: z.string(), to: z.string() });
export const BorrowSchema = z.object({ chain: chainEnum, asset: z.string(), amount: z.string(), onBehalfOf: z.string() });
export const RepaySchema = z.object({ chain: chainEnum, asset: z.string(), amount: z.string(), onBehalfOf: z.string() });

export const SwapSchema = z.object({ chain: chainEnum, amountIn: z.string(), amountOutMin: z.string(), path: z.array(z.string()), to: z.string(), deadline: z.string() });
export const BridgeSchema = z.object({ chain: chainEnum, amount: z.string(), destinationDomain: z.number(), mintRecipient: z.string(), burnToken: z.string() });
export const AddLiquiditySchema = z.object({ chain: chainEnum, tokenA: z.string(), tokenB: z.string(), amountA: z.string(), amountB: z.string(), to: z.string(), deadline: z.string() });
export const RemoveLiquiditySchema = z.object({ chain: chainEnum, tokenA: z.string(), tokenB: z.string(), liquidity: z.string(), to: z.string(), deadline: z.string() });
