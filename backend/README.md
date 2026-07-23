# Vitael Backend

Fastify API for Supabase-backed public wallet profiles, chat history,
transaction history, and the Arc indexer.

## Local setup

1. Copy `.env.example` to `.env` and fill values locally.
2. Run `npm install`.
3. Run `npm run dev`.
4. Check `GET /health` and `GET /health/db`.

Never commit `.env` or expose `SUPABASE_SECRET_KEY` to the frontend.

Profiles and chat history are keyed by the connected public wallet address.
No additional sign-in or message signature is required.

## Endpoints

### Health

- `GET /health`
- `GET /health/db`

### Profiles

- `GET /api/profiles/:walletAddress`
- `PUT /api/profiles/:walletAddress`
- `POST /api/profiles/:walletAddress/avatar` (multipart field: `file`, max 2 MB)

### Chat history

- `GET /api/chat/conversations?walletAddress=0x...`
- `POST /api/chat/conversations`
- `PATCH /api/chat/conversations/:id`
- `DELETE /api/chat/conversations/:id?walletAddress=0x...`
- `GET /api/chat/conversations/:id/messages?walletAddress=0x...`
- `POST /api/chat/conversations/:id/messages`

### On-chain history and analytics

- `GET /api/transactions/:walletAddress`
- `GET /api/protocol/stats?chainId=5042002`
- `GET /api/protocol/history?chainId=5042002`
- `GET /api/protocol/indexer-status`

Transaction and protocol snapshot tables are read-only through the public API.
Only the trusted Railway indexer writes verified on-chain data.

## Arc indexer worker

The worker backfills and continuously indexes confirmed events from the current
Vitael lending pool, DEX pairs, and outbound Arc CCTP bridge. It also writes a
protocol snapshot every five minutes.

- Development: `npm run dev:indexer`
- Production/Railway start command: `npm run start:indexer`
- Build command: `npm run build`

Create a second Railway service from the same `backend` directory. Reuse the API
environment variables and set its start command to `npm run start:indexer`.
Do not expose this worker as a public HTTP service.

`INDEXER_START_BLOCK=44966040` is the DEX deployment block. The worker stores its
last confirmed block in `indexer_state`, scans in small chunks, uses multiple Arc
RPC endpoints, and resumes after restarts. `tvl_usd` is the token value physically
held by the lending pool plus DEX reserves; `total_supplied_usd` and
`total_borrowed_usd` are reported separately.
