import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { z } from "zod";

let mcpClient: Client | null = null;
let transport: StdioClientTransport | SSEClientTransport | null = null;

export async function getMCPClient() {
  if (mcpClient) return mcpClient;

  const serverUrl = process.env.MCP_SERVER_URL;
  if (!serverUrl) {
    throw new Error("MCP_SERVER_URL is not defined in environment variables");
  }

  mcpClient = new Client(
    { name: "vitael-frontend", version: "1.0.0" },
    { capabilities: {} }
  );

  if (serverUrl.startsWith("http")) {
    transport = new SSEClientTransport(new URL(serverUrl));
  } else {
    // Treat as local file path
    transport = new StdioClientTransport({
      command: "node",
      args: [serverUrl],
    });
  }

  await mcpClient.connect(transport);
  return mcpClient;
}

export async function getMCPTools() {
  const client = await getMCPClient();
  const result = await client.request({ method: "tools/list" }, z.any() as any);
  return result.tools;
}

export async function callMCPTool(name: string, args: Record<string, any>) {
  const client = await getMCPClient();
  return client.request(
    {
      method: "tools/call",
      params: { name, arguments: args },
    },
    // The SDK types expect specific schema, but we can cast or rely on default inference
    z.any() as any
  ) as Promise<{ content: Array<{ type: string; text: string }>, isError?: boolean }>;
}
