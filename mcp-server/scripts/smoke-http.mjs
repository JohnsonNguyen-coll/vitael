import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.env.MCP_TEST_URL ?? "http://127.0.0.1:3002/mcp";
const apiKey = process.env.MCP_API_KEY;
const client = new Client({ name: "vitael-mcp-smoke-test", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(url), {
  requestInit: apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : undefined,
});

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  if (tools.length < 10) throw new Error(`Expected Vitael tools, received ${tools.length}`);

  const result = await client.callTool({
    name: "bridge",
    arguments: {
      chain: "arcTestnet",
      amount: "1000000",
      destinationDomain: 0,
      mintRecipient: "0x0000000000000000000000000000000000000001",
      burnToken: "USDC",
    },
  });
  if (result.isError) throw new Error("Bridge payload tool returned an error");

  console.log(JSON.stringify({ ok: true, toolCount: tools.length, sessionId: transport.sessionId }));
} finally {
  await transport.terminateSession().catch(() => undefined);
  await client.close().catch(() => undefined);
}
