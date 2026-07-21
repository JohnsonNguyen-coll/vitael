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

Transaction and protocol snapshot tables are read-only through the public API.
Only the trusted Railway indexer writes verified on-chain data.
