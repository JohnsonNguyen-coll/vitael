import * as dotenv from 'dotenv';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { DefiService } from "./services/defiService.js";
import * as schemas from "./tools/schemas.js";

function createMcpServer() {
  const server = new Server(
    {
      name: "vitael-mcp-server",
      version: "1.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Read operations
      { name: "getMarkets", description: "Get active markets for a given chain", inputSchema: { type: "object", properties: { chain: { type: "string" } }, required: ["chain"] } },
      { name: "getPools", description: "Get liquidity pools for a given chain", inputSchema: { type: "object", properties: { chain: { type: "string" } }, required: ["chain"] } },
      { name: "getLiquidityPosition", description: "Get a user's exact VLP balance, pool ownership percentage, and redeemable underlying token amounts. A non-zero raw balance is an active LP position even when the 18-decimal display value is tiny.", inputSchema: { type: "object", properties: { chain: { type: "string" }, userAddress: { type: "string" }, tokenA: { type: "string" }, tokenB: { type: "string" } }, required: ["chain", "userAddress", "tokenA", "tokenB"] } },
      { name: "getAPR", description: "Get APR for an asset", inputSchema: { type: "object", properties: { chain: { type: "string" }, asset: { type: "string" } }, required: ["chain", "asset"] } },
      { name: "getPosition", description: "Get user position", inputSchema: { type: "object", properties: { chain: { type: "string" }, userAddress: { type: "string" } }, required: ["chain", "userAddress"] } },
      { name: "getHealthFactor", description: "Get user health factor", inputSchema: { type: "object", properties: { chain: { type: "string" }, userAddress: { type: "string" } }, required: ["chain", "userAddress"] } },
      { name: "getBalance", description: "Get user wallet balance for an asset", inputSchema: { type: "object", properties: { chain: { type: "string" }, userAddress: { type: "string" }, asset: { type: "string" } }, required: ["chain", "userAddress", "asset"] } },
      { name: "getVaults", description: "Get Vitael yield vaults, live APY, TVL, cap, liquidity, and emergency status", inputSchema: { type: "object", properties: { chain: { type: "string" } }, required: ["chain"] } },
      { name: "getVaultPosition", description: "Get a user's USDC vault shares, asset value, and currently withdrawable amount", inputSchema: { type: "object", properties: { chain: { type: "string" }, userAddress: { type: "string" } }, required: ["chain", "userAddress"] } },
      { name: "getVaultQuote", description: "Preview a vault deposit or validate a withdrawal. amount is in USDC atomic units (6 decimals).", inputSchema: { type: "object", properties: { chain: { type: "string" }, action: { type: "string", enum: ["deposit", "withdraw"] }, amount: { type: "string" }, userAddress: { type: "string" } }, required: ["chain", "action", "amount"] } },
      
      // Quotes
      { name: "quoteSwap", description: "Quote a token swap", inputSchema: { type: "object", properties: { chain: { type: "string" }, amountIn: { type: "string" }, path: { type: "array", items: { type: "string" } } }, required: ["chain", "amountIn", "path"] } },
      { name: "quoteBridge", description: "Quote bridging value across chains", inputSchema: { type: "object", properties: { fromChain: { type: "string" }, toChain: { type: "string" }, amount: { type: "string" } }, required: ["fromChain", "toChain", "amount"] } },
      { name: "quoteAddLiquidity", description: "Quote adding liquidity", inputSchema: { type: "object", properties: { chain: { type: "string" }, tokenA: { type: "string" }, tokenB: { type: "string" }, amountA: { type: "string" } }, required: ["chain", "tokenA", "tokenB", "amountA"] } },
      
      // Write Operations (return unsigned TX)
      { name: "deposit", description: "Generate deposit transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, asset: { type: "string" }, amount: { type: "string" }, onBehalfOf: { type: "string" } }, required: ["chain", "asset", "amount", "onBehalfOf"] } },
      { name: "withdraw", description: "Generate withdraw transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, asset: { type: "string" }, amount: { type: "string" }, to: { type: "string" } }, required: ["chain", "asset", "amount", "to"] } },
      { name: "borrow", description: "Generate borrow transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, asset: { type: "string" }, amount: { type: "string" }, onBehalfOf: { type: "string" } }, required: ["chain", "asset", "amount", "onBehalfOf"] } },
      { name: "repay", description: "Generate repay transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, asset: { type: "string" }, amount: { type: "string" }, onBehalfOf: { type: "string" } }, required: ["chain", "asset", "amount", "onBehalfOf"] } },
      { name: "depositVault", description: "Generate an unsigned USDC vault deposit plus its required token approval. amount is in USDC atomic units (6 decimals).", inputSchema: { type: "object", properties: { chain: { type: "string" }, amount: { type: "string" }, receiver: { type: "string" } }, required: ["chain", "amount", "receiver"] } },
      { name: "withdrawVault", description: "Generate an unsigned USDC vault withdrawal. amount is in USDC atomic units (6 decimals).", inputSchema: { type: "object", properties: { chain: { type: "string" }, amount: { type: "string" }, receiver: { type: "string" } }, required: ["chain", "amount", "receiver"] } },
      { name: "swap", description: "Generate swap transaction", inputSchema: { type: "object", properties: { chain: { type: "string" }, amountIn: { type: "string" }, amountOutMin: { type: "string" }, path: { type: "array", items: { type: "string" } }, to: { type: "string" }, deadline: { type: "string" } }, required: ["chain", "amountIn", "amountOutMin", "path", "to", "deadline"] } },
      { name: "bridge", description: "Generate a CCTP V2 forwarding transaction. amount is the exact human-readable USDC amount requested by the user (for example, \"0.1\" means 0.1 USDC). Never pre-subtract fees or convert amount to atomic units.", inputSchema: { type: "object", properties: { chain: { type: "string" }, amount: { type: "string", description: "Exact human-readable USDC amount requested, e.g. 0.1" }, destinationDomain: { type: "number" }, mintRecipient: { type: "string" }, burnToken: { type: "string" }, destinationCaller: { type: "string" }, maxFee: { type: "string", description: "Maximum CCTP fee in USDC atomic units from quoteBridge" }, minFinalityThreshold: { type: "number" }, hookData: { type: "string" } }, required: ["chain", "amount", "destinationDomain", "mintRecipient", "burnToken"] } },
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
      case "getLiquidityPosition": {
        const parsed = schemas.GetLiquidityPositionSchema.parse(args);
        result = await DefiService.getLiquidityPosition(parsed.chain, parsed.userAddress, parsed.tokenA, parsed.tokenB);
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
      case "getBalance": {
        const parsed = schemas.GetBalanceSchema.parse(args);
        result = await DefiService.getBalance(parsed.chain, parsed.userAddress, parsed.asset);
        break;
      }
      case "getVaults": {
        const parsed = schemas.GetVaultsSchema.parse(args);
        result = await DefiService.getVaults(parsed.chain);
        break;
      }
      case "getVaultPosition": {
        const parsed = schemas.GetVaultPositionSchema.parse(args);
        result = await DefiService.getVaultPosition(parsed.chain, parsed.userAddress);
        break;
      }
      case "getVaultQuote": {
        const parsed = schemas.GetVaultQuoteSchema.parse(args);
        result = await DefiService.getVaultQuote(parsed.chain, parsed.action, parsed.amount, parsed.userAddress);
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
      case "depositVault": {
        const parsed = schemas.DepositVaultSchema.parse(args);
        result = DefiService.generateDepositVaultPayload(parsed.chain, parsed.amount, parsed.receiver);
        break;
      }
      case "withdrawVault": {
        const parsed = schemas.WithdrawVaultSchema.parse(args);
        result = DefiService.generateWithdrawVaultPayload(parsed.chain, parsed.amount, parsed.receiver);
        break;
      }
      case "swap": {
        const parsed = schemas.SwapSchema.parse(args);
        result = DefiService.generateSwapPayload(parsed.chain, parsed.amountIn, parsed.amountOutMin, parsed.path, parsed.to, parsed.deadline);
        break;
      }
      case "bridge": {
        const parsed = schemas.BridgeSchema.parse(args);
        result = DefiService.generateBridgePayload(
          parsed.chain,
          parsed.amount,
          parsed.destinationDomain,
          parsed.mintRecipient,
          parsed.burnToken,
          parsed.destinationCaller,
          parsed.maxFee,
          parsed.minFinalityThreshold,
          parsed.hookData,
        );
        break;
      }
      case "addLiquidity": {
        const parsed = schemas.AddLiquiditySchema.parse(args);
        result = await DefiService.generateAddLiquidityPayload(parsed.chain, parsed.tokenA, parsed.tokenB, parsed.amountA, parsed.amountB, parsed.to, parsed.deadline);
        break;
      }
      case "removeLiquidity": {
        const parsed = schemas.RemoveLiquiditySchema.parse(args);
        result = await DefiService.generateRemoveLiquidityPayload(parsed.chain, parsed.tokenA, parsed.tokenB, parsed.liquidity, parsed.to, parsed.deadline);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown MCP tool error";
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

async function startStdio() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Vitael MCP Server running on stdio");
}

type Session = {
  server: Server;
  transport: StreamableHTTPServerTransport;
};

const sessions = new Map<string, Session>();
const maxSessions = Number.parseInt(process.env.MCP_MAX_SESSIONS ?? "100", 10);

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function authorized(req: IncomingMessage) {
  const configuredKey = process.env.MCP_API_KEY;
  if (!configuredKey) return process.env.NODE_ENV !== "production";

  const authorization = req.headers.authorization;
  const suppliedKey =
    (authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined) ??
    (Array.isArray(req.headers["x-api-key"]) ? req.headers["x-api-key"][0] : req.headers["x-api-key"]);

  if (!suppliedKey) return false;

  const expected = Buffer.from(configuredKey);
  const actual = Buffer.from(suppliedKey);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_048_576) throw new Error("Request body exceeds 1 MB");
    chunks.push(buffer);
  }

  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function closeSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  await session.transport.close().catch(() => undefined);
  await session.server.close().catch(() => undefined);
}

async function handleMcp(req: IncomingMessage, res: ServerResponse) {
  if (!authorized(req)) {
    res.setHeader("www-authenticate", "Bearer");
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  const sessionHeader = req.headers["mcp-session-id"];
  const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;

  if (req.method === "POST") {
    let body: unknown;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        error: { code: -32700, message: error instanceof Error ? error.message : "Invalid JSON" },
        id: null,
      });
      return;
    }

    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        sendJson(res, 404, {
          jsonrpc: "2.0",
          error: { code: -32001, message: "MCP session not found" },
          id: null,
        });
        return;
      }
      await session.transport.handleRequest(req, res, body);
      return;
    }

    if (!isInitializeRequest(body)) {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        error: { code: -32000, message: "Initialize the MCP session first" },
        id: null,
      });
      return;
    }

    if (sessions.size >= maxSessions) {
      sendJson(res, 503, {
        jsonrpc: "2.0",
        error: { code: -32002, message: "MCP session capacity reached" },
        id: null,
      });
      return;
    }

    const server = createMcpServer();
    let transport: StreamableHTTPServerTransport;
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (newSessionId) => {
        sessions.set(newSessionId, { server, transport });
      },
      onsessionclosed: async (closedSessionId) => {
        await closeSession(closedSessionId);
      },
    });
    transport.onerror = (error) => console.error("[mcp] transport error", error);
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    return;
  }

  if (req.method === "GET" || req.method === "DELETE") {
    if (!sessionId) {
      sendJson(res, 400, { error: "Missing Mcp-Session-Id header" });
      return;
    }
    const session = sessions.get(sessionId);
    if (!session) {
      sendJson(res, 404, { error: "MCP session not found" });
      return;
    }
    await session.transport.handleRequest(req, res);
    return;
  }

  res.setHeader("allow", "GET, POST, DELETE");
  sendJson(res, 405, { error: "Method not allowed" });
}

async function startHttp() {
  if (process.env.NODE_ENV === "production" && !process.env.MCP_API_KEY) {
    throw new Error("MCP_API_KEY is required in production");
  }

  const host = process.env.HOST ?? "0.0.0.0";
  const port = Number.parseInt(process.env.PORT ?? "3002", 10);
  const httpServer = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      if (url.pathname === "/health" && req.method === "GET") {
        sendJson(res, 200, {
          status: "ok",
          service: "vitael-mcp",
          transport: "streamable-http",
          sessions: sessions.size,
        });
        return;
      }
      if (url.pathname === "/mcp") {
        await handleMcp(req, res);
        return;
      }
      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      console.error("[mcp] request failed", error);
      if (!res.headersSent) {
        sendJson(res, 500, {
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      } else {
        res.end();
      }
    }
  });

  httpServer.listen(port, host, () => {
    console.log(`Vitael MCP Streamable HTTP listening on http://${host}:${port}/mcp`);
  });

  const shutdown = async () => {
    httpServer.close();
    await Promise.all([...sessions.keys()].map(closeSession));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

const transportMode = process.env.MCP_TRANSPORT ?? (process.env.PORT ? "http" : "stdio");
const main = transportMode === "stdio" ? startStdio : startHttp;

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
