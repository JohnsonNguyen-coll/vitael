# Vitael MCP server

Vitael's MCP server supports two transports:

- Streamable HTTP for Railway and other remote deployments (`/mcp`)
- stdio for local process integrations

## Local HTTP

Copy `.env.example` to `.env`, set `MCP_API_KEY`, then run:

```powershell
$env:MCP_TRANSPORT="http"
npm run dev
```

Health check:

```text
GET http://localhost:3002/health
```

MCP endpoint:

```text
http://localhost:3002/mcp
```

After building, the HTTP smoke test can be run against a running server:

```powershell
$env:MCP_API_KEY="<same key as server>"
npm run smoke:http
```

## Railway

Create a service with root directory `/mcp-server`. Railway will build the included
`Dockerfile`. Generate a public domain and set the healthcheck path to `/health`.
Do not override Railway's `PORT`.

Required variables:

```text
NODE_ENV=production
MCP_TRANSPORT=http
HOST=0.0.0.0
MCP_API_KEY=<long random secret>
RPC_ARC_TESTNET=https://rpc.testnet.arc.network
RPC_ARC_FALLBACK_URLS=https://rpc.drpc.testnet.arc.network,https://rpc.quicknode.testnet.arc.network
```

Set these server-only variables in Vercel:

```text
MCP_SERVER_URL=https://<railway-domain>/mcp
MCP_API_KEY=<same secret>
```

Never prefix `MCP_API_KEY` with `NEXT_PUBLIC_`.
