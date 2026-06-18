import 'dotenv/config';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { DefiService } from "./services/defiService.js";
import * as schemas from "./tools/schemas.js";

const server = new Server(
  {
    name: "vitael-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Read operations
      { name: "getMarkets", description: "Get active markets for a given chain", inputSchema: { type: "object", properties: { chain: { type: "string" } }, required: ["chain"] } },
      { name: "getPools", description: "Get liquidity pools for a given chain", inputSchema: { type: "object", properties: { chain: { type: "string" } }, required: ["chain"] } },
      { name: "getAPR", description: "Get APR for an asset", inputSchema: { type: "object", properties: { chain: { type: "string" }, asset: { type: "string" } }, required: ["chain", "asset"] } },
      { name: "getPosition", description: "Get user position", inputSchema: { type: "object", properties: { chain: { type: "string" }, userAddress: { type: "string" } }, required: ["chain", "userAddress"] } },
      { name: "getHealthFactor", description: "Get user health factor", inputSchema: { type: "object", properties: { chain: { type: "string" }, userAddress: { type: "string" } }, required: ["chain", "userAddress"] } },
      
      // Quotes
      { name: "quoteSwap", description: "Quote a token swap", inputSchema: { type: "object", properties: { chain: { type: "string" }, amountIn: { type: "string" }, path: { type: "array", items: { type: "string" } } }, required: ["chain", "amountIn", "path"] } },
      { name: "quoteBridge", description: "Quote bridging value across chains", inputSchema: { type: "object", properties: { fromChain: { type: "string" }, toChain: { type: "string" }, amount: { type: "string" } }, required: ["fromChain", "toChain", "amount"] } },
      { name: "quoteAddLiquidity", description: "Quote adding liquidity", inputSchema: { type: "object", properties: { chain: { type: "string" }, tokenA: { type: "string" }, tokenB: { type: "string" }, amountA: { type: "string" } }, required: ["chain", "tokenA", "tokenB", "amountA"] } },
      
      // Write Operations (return unsigned TX)
      { name: "deposit", description: "Generate deposit transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, asset: { type: "string" }, amount: { type: "string" }, onBehalfOf: { type: "string" } }, required: ["chain", "asset", "amount", "onBehalfOf"] } },
      { name: "withdraw", description: "Generate withdraw transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, asset: { type: "string" }, amount: { type: "string" }, to: { type: "string" } }, required: ["chain", "asset", "amount", "to"] } },
      { name: "borrow", description: "Generate borrow transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, asset: { type: "string" }, amount: { type: "string" }, onBehalfOf: { type: "string" } }, required: ["chain", "asset", "amount", "onBehalfOf"] } },
      { name: "repay", description: "Generate repay transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, asset: { type: "string" }, amount: { type: "string" }, onBehalfOf: { type: "string" } }, required: ["chain", "asset", "amount", "onBehalfOf"] } },
      { name: "swap", description: "Generate swap transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, amountIn: { type: "string" }, amountOutMin: { type: "string" }, path: { type: "array", items: { type: "string" } }, to: { type: "string" }, deadline: { type: "string" } }, required: ["chain", "amountIn", "amountOutMin", "path", "to", "deadline"] } },
      { name: "bridge", description: "Generate bridge transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, amount: { type: "string" }, destinationDomain: { type: "number" }, mintRecipient: { type: "string" }, burnToken: { type: "string" } }, required: ["chain", "amount", "destinationDomain", "mintRecipient", "burnToken"] } },
      { name: "addLiquidity", description: "Generate add liquidity transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, tokenA: { type: "string" }, tokenB: { type: "string" }, amountA: { type: "string" }, amountB: { type: "string" }, to: { type: "string" }, deadline: { type: "string" } }, required: ["chain", "tokenA", "tokenB", "amountA", "amountB", "to", "deadline"] } },
      { name: "removeLiquidity", description: "Generate remove liquidity transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, tokenA: { type: "string" }, tokenB: { type: "string" }, liquidity: { type: "string" }, to: { type: "string" }, deadline: { type: "string" } }, required: ["chain", "tokenA", "tokenB", "liquidity", "to", "deadline"] } },
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    let result;

    switch (name) {
      case "getMarkets": {
        const parsed = schemas.GetMarketsSchema.parse(args);
        result = await DefiService.getMarkets(parsed.chain);
        break;
      }
      case "getPools": {
        const parsed = schemas.GetPoolsSchema.parse(args);
        result = await DefiService.getPools(parsed.chain);
        break;
      }
      case "getAPR": {
        const parsed = schemas.GetAPRSchema.parse(args);
        result = await DefiService.getAPR(parsed.chain, parsed.asset);
        break;
      }
      case "getPosition": {
        const parsed = schemas.GetPositionSchema.parse(args);
        result = await DefiService.getPosition(parsed.chain, parsed.userAddress);
        break;
      }
      case "getHealthFactor": {
        const parsed = schemas.GetHealthFactorSchema.parse(args);
        result = await DefiService.getHealthFactor(parsed.chain, parsed.userAddress);
        break;
      }
      case "quoteSwap": {
        const parsed = schemas.QuoteSwapSchema.parse(args);
        result = await DefiService.quoteSwap(parsed.chain, parsed.amountIn, parsed.path);
        break;
      }
      case "quoteBridge": {
        const parsed = schemas.QuoteBridgeSchema.parse(args);
        result = await DefiService.quoteBridge(parsed.fromChain, parsed.toChain, parsed.amount);
        break;
      }
      case "quoteAddLiquidity": {
        const parsed = schemas.QuoteAddLiquiditySchema.parse(args);
        result = await DefiService.quoteAddLiquidity(parsed.chain, parsed.tokenA, parsed.tokenB, parsed.amountA);
        break;
      }
      case "deposit": {
        const parsed = schemas.DepositSchema.parse(args);
        result = DefiService.generateDepositPayload(parsed.chain, parsed.asset, parsed.amount, parsed.onBehalfOf);
        break;
      }
      case "withdraw": {
        const parsed = schemas.WithdrawSchema.parse(args);
        result = DefiService.generateWithdrawPayload(parsed.chain, parsed.asset, parsed.amount, parsed.to);
        break;
      }
      case "borrow": {
        const parsed = schemas.BorrowSchema.parse(args);
        result = DefiService.generateBorrowPayload(parsed.chain, parsed.asset, parsed.amount, parsed.onBehalfOf);
        break;
      }
      case "repay": {
        const parsed = schemas.RepaySchema.parse(args);
        result = DefiService.generateRepayPayload(parsed.chain, parsed.asset, parsed.amount, parsed.onBehalfOf);
        break;
      }
      case "swap": {
        const parsed = schemas.SwapSchema.parse(args);
        result = DefiService.generateSwapPayload(parsed.chain, parsed.amountIn, parsed.amountOutMin, parsed.path, parsed.to, parsed.deadline);
        break;
      }
      case "bridge": {
        const parsed = schemas.BridgeSchema.parse(args);
        result = DefiService.generateBridgePayload(parsed.chain, parsed.amount, parsed.destinationDomain, parsed.mintRecipient, parsed.burnToken);
        break;
      }
      case "addLiquidity": {
        const parsed = schemas.AddLiquiditySchema.parse(args);
        result = DefiService.generateAddLiquidityPayload(parsed.chain, parsed.tokenA, parsed.tokenB, parsed.amountA, parsed.amountB, parsed.to, parsed.deadline);
        break;
      }
      case "removeLiquidity": {
        const parsed = schemas.RemoveLiquiditySchema.parse(args);
        result = DefiService.generateRemoveLiquidityPayload(parsed.chain, parsed.tokenA, parsed.tokenB, parsed.liquidity, parsed.to, parsed.deadline);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Vitael MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
