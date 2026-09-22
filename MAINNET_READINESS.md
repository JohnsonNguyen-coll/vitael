# Vitael mainnet preparation

Status: not ready for public deposits. This is an implementation checklist, not an audit or a deployment approval. No mainnet transaction has been submitted.

## Implemented: dedicated collateral accounting

- `contracts/src/VitaelLendingPool.sol`: track aggregate dedicated collateral per asset. Exclude it from supplier exchange rates, interest calculations, utilization, borrow/withdraw liquidity and reserve withdrawals. Update custody on deposits, withdrawals and liquidation, preserving the pre-transfer cash balance during health checks and share conversions.
- `contracts/src/vaults/VitaelUSDCVault.sol`: use the pool's collateral-excluding liquidity for ERC-4626 withdrawal limits.
- Regression tests: `contracts/test/CollateralAccounting.t.sol` and `contracts/test/VaultCollateralAccounting.t.sol`.

Dedicated collateral is separate from supply accounting. Supply positions ALSO count toward borrowing collateral in the existing `_positionValues` implementation; this behavior is unchanged.

The new `getAvailableLiquidity(asset)` returns token cash less dedicated collateral, including liquid protocol reserves. It does not change the existing reserve policy. Supported tokens must have exact transfer accounting; fee-on-transfer/rebasing token support is not introduced.

These changes require a newly deployed pool and a vault constructed with that pool. They do not repair existing deployed contracts or migrate balances. Never attach zero-initialized collateral totals to an existing funded pool.

### Validation (2026-09-22)

Three initial regressions failed against the original pool: supplier claims included dedicated collateral, borrowers could spend it, and depositing it changed pending interest/rates. After the fix, the final collateral suite passed all 26 tests (17 inherited baseline tests plus 9 new tests, including 256 fuzz cases). The vault regression suite passed all 7 tests (6 inherited plus 1 new). Existing lending/vault suites also passed; all 3 existing vault invariants passed 256 runs / 128,000 calls each. A test-only caller setup issue in the first full run was corrected and its entire suite rerun successfully; production code was unchanged by that correction. Formatting checks for the pool/new tests and `git diff --check` passed.

Commands run from `contracts/` (alternate output paths avoided local permissions on existing build artifacts):

```text
forge test --out out-collateral --cache-path cache-collateral -vv
forge test --out out-collateral --cache-path cache-collateral --match-contract '^CollateralAccountingTest$' -vv
forge fmt --check src/VitaelLendingPool.sol test/CollateralAccounting.t.sol test/VaultCollateralAccounting.t.sol
```

No live-network, frontend or backend tests were run for this contract-only fix.

## Release blockers and file-level work

| Priority | Files | Required change / acceptance criteria |
| --- | --- | --- |
| P0 | `contracts/src/VitaelOracle.sol`, `contracts/src/StorkPriceFeed.sol` | Check price timestamps, maximum age, future/zero timestamps and decimal normalization. Verify each real mainnet feed and price identifier. Define failure behavior; test stale/invalid prices. |
| P0 | `contracts/src/VitaelLendingPool.sol` | Review LTV enforcement: `borrow` checks liquidation health factor but does not enforce the computed LTV limit. Review transient balances during borrow/withdraw health checks, supply-share rounding, donation/first-depositor behavior, debt rounding, reserve liquidity and liquidation with insufficient collateral/bad debt. Add regression and stateful invariant tests. |
| P0 | `contracts/src/dex/*.sol`, `contracts/src/vaults/VitaelUSDCVault.sol`, `contracts/test/` | Audit DEX, pool and vault together. Test manipulation, slippage/deadlines, rounding, liquidity exhaustion, emergency controls and supported token behaviors. Existing tests are not evidence of a completed security audit. |
| P0 | `contracts/src/LendingConfig.sol`, `contracts/script/DeployVitael.s.sol`, `DeployVitaelDEX.s.sol`, `DeployUSDCVault.s.sol`, `contracts/foundry.toml` | Separate network manifests. Require expected chain ID, valid deployed token/feed code and production addresses; reject mock feeds on mainnet. Dry-run scripts, verify source and record deployment blocks/constructor arguments. |
| P0 | Contract ownership and deployment scripts | Transfer roles to a verified multisig; design delayed sensitive changes, incident pause/recovery and supply/borrow caps. Reassess LTV/threshold/bonus parameters against real liquidity. |
| P1 | `frontend/src/app/providers.tsx`, `frontend/src/lib/arcTokens.ts`, `contracts.ts`, `arcTransport.ts`, `frontend/src/components/NetworkGuard.tsx` | Shared testnet/mainnet configuration; verified RPC/chain/explorer/token addresses and decimals; no silent testnet fallback in production. Verify native USDC versus ERC-20 unit handling. |
| P1 | `frontend/src/hooks/useLending.ts` | Add pool liquidity getter ABI and replace raw token `balanceOf(pool)` liquidity reads. Correct supplied totals for collateral and reserves. Coordinate activation with deployment of the new ABI. |
| P1 | `frontend/src/hooks/useCCTPBridge.ts`, `frontend/src/app/api/bridge/route.ts`, `frontend/src/app/api/swap/route.ts` | Verify supported production routes, CCTP domains/contracts, fee quotes and attestation API. Disable unsupported routes; test complete cross-chain settlement and recovery. |
| P1 | `mcp-server/src/services/viemClient.ts`, `defiService.ts`, `contracts/abi.ts`, `tools/schemas.ts` | Add mainnet chain manifest and ABI; verify protocol addresses and liquidity semantics. Correct native currency metadata. Reject mismatched chain/token/contract requests. |
| P1 | `frontend/src/app/api/agent/route.ts`, `api/chat/route.ts`, `frontend/src/components/agent/TransactionPreviewCard.tsx` | Remove forced `arcTestnet` behavior for production. Enforce transaction allowlists, chain, recipient, amount, allowance, deadline and slippage in code. Simulate transactions and require wallet authorization. Test multi-step failures. |
| P1 | `backend/src/config/env.ts`, `backend/src/indexer/client.ts`, `contracts.ts`, `worker.ts` | Production RPC and addresses; start at deployment block; segregate indexer state and history by network. Keep physical TVL distinct from supplier claims and dedicated collateral. Include vault event coverage or document its absence. |
| P1 | `backend/src/routes/profiles.ts`, `chat.ts`, `frontend/src/lib/backendApi.ts`, Supabase migrations | Authenticate wallet ownership with nonce/domain/expiry and authorize profile/chat changes; decide chat privacy. Current public address alone is not proof of ownership. Keep production credentials server-side; document/apply migrations reproducibly (Supabase directory is currently gitignored). |
| P1 | `.github/workflows/test.yml`, package scripts | Add frontend lint/build, backend/MCP typecheck, API authorization tests and end-to-end transaction tests. Preserve Foundry fuzz/invariant checks and audit findings as release gates. |

## Deployment sequence after blockers are resolved

1. Record verified mainnet chain ID, RPCs, token addresses/decimals, feeds, CCTP configuration and multisig in a reviewed manifest. Values have not been populated in this change.
2. Complete security fixes, independent audit and remediation; rehearse deployment and user flows against the intended network state.
3. Deploy oracle/feeds, lending pool, DEX components and vault in dependency order; register only verified supported assets. Verify bytecode/source and ownership.
4. Deploy production API/MCP/frontend with matching manifests and isolated data; start indexer from recorded deployment blocks.
5. Run bounded real-transaction checks with operator funds: supply/withdraw, collateral, borrow/repay, swap/LP, vault deposit/redeem and supported bridge routes.
6. Enable monitored limited deposits only after liquidation operations, alerting and incident procedures have been tested. Increase limits through an explicit risk review.

Testnet positions are not mainnet balances. Keep the old testnet interface available if users need to inspect or close their test positions.
