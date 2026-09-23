# CCTP mainnet bridge

Bridge page and MCP bridge tools now use Ethereum (1/domain 0), Avalanche (43114/1), Optimism (10/2), Arbitrum (42161/3), Base (8453/6), Polygon (137/7), and Arc (5042/26). CCTP uses domains, not EVM chain IDs, for destinationDomain.

Sources verified 2026-09-23:
- https://developers.circle.com/cctp/references/contract-addresses
- https://developers.circle.com/stablecoins/usdc-contract-addresses
- https://developers.circle.com/cctp/concepts/forwarding-service

The bridge uses native mainnet USDC, TokenMessengerV2 0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d and https://iris-api.circle.com. It does not deploy a bridge contract. The old BRIDGE environment variable is not used by the mainnet bridge, so stale testnet values cannot redirect approvals.

## RPC overrides

Default public mainnet endpoints are supplied. Set NEXT_PUBLIC_CCTP_<CHAIN>_RPC_URL on the frontend, or CCTP_<CHAIN>_RPC_URL on MCP, where CHAIN is ETHEREUM, ARBITRUM, BASE, POLYGON, AVALANCHE, OPTIMISM or ARC. Do not reuse testnet RPCs. Browser variables are public; use browser-safe RPC credentials. No existing private .env files were rewritten.

## Amounts and completion

User-entered amount is the total USDC burned, with fees deducted from it. minimumFee from Circle is in basis points; forwardFee.med is in USDC atomic units. Both clients round the proportional fee upward and reject invalid, unavailable or amount-exceeding fees. quoteBridge returns maxFeeAtomic, minimumReceivedAtomic and minFinalityThreshold. This is a current quote, not a guarantee against fee changes before execution.

Frontend requires approval confirmation before burn. Bridge page and agent wait for a successful destination forwarding transaction receipt before reporting completion. A timeout can mean pending forwarding: retain the source transaction hash and check its status before retrying. Do not burn a second time to recover a pending transfer.

## Validation and rollout

Run `node --import tsx scripts/test-cctp.ts` from mcp-server. Tests cover fee units and rounding, seven mainnet payloads, and rejection of testnet routes, same-chain transfers and incorrect tokens. Frontend and MCP TypeScript checks and scoped frontend lint are also run. Circle production returned forwarding quotes for all 12 directions between Arc and the other six chains. No real USDC transfer was sent during validation.

Rebuild/redeploy frontend and MCP to apply these changes. Railway/backend indexer and lending/DEX/vault frontend configuration are separate from this bridge migration and may still point to testnet. The wallet provider retains the old networks for those existing flows, while the bridge selector and MCP bridge reject testnet routes.

Before public launch, verify one small real transfer end-to-end with the intended wallet and confirm receipt of native USDC on the destination. Automated checks do not replace that wallet integration check.
