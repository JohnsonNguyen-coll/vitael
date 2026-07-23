import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

let mcpClient: Client | null = null;
let connecting: Promise<Client> | null = null;
let transport: StdioClientTransport | StreamableHTTPClientTransport | null = null;

export type MCPToolCallResult = {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

export async function getMCPClient() {
  if (mcpClient) return mcpClient;
  if (connecting) return connecting;

  connecting = (async () => {
    const serverUrl = process.env.MCP_SERVER_URL?.trim();
    if (!serverUrl) {
      throw new Error("MCP_SERVER_URL is not defined in environment variables");
    }

    const client = new Client(
      { name: "vitael-frontend", version: "1.1.0" },
      { capabilities: {} }
    );

    if (serverUrl.startsWith("http")) {
      const apiKey = process.env.MCP_API_KEY?.trim();
      transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
        requestInit: apiKey
          ? { headers: { Authorization: `Bearer ${apiKey}` } }
          : undefined,
      });
    } else {
      transport = new StdioClientTransport({
        command: "node",
        args: [serverUrl],
        env: {
          ...process.env,
          MCP_TRANSPORT: "stdio",
        },
      });
    }

    await client.connect(transport);
    mcpClient = client;
    return client;
  })();

  try {
    return await connecting;
  } catch (error) {
    mcpClient = null;
    transport = null;
    throw error;
  } finally {
    connecting = null;
  }
}

export async function getMCPTools() {
  const client = await getMCPClient();
  const result = await client.listTools();
  return result.tools;
}

export async function callMCPTool(name: string, args: Record<string, unknown>) {
  const client = await getMCPClient();
  const result = await client.callTool({ name, arguments: args });
  return result as MCPToolCallResult;
}
