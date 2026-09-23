# Vitael mainnet preparation

Status: not ready for public deposits. This is an implementation checklist, not an audit or a deployment approval. No mainnet transaction has been submitted.

## Implemented: dedicated collateral accounting

- `contracts/src/VitaelLendingPool.sol`: track aggregate dedicated collateral per asset. Exclude it from supplier exchange rates, interest calculations, utilization, borrow/withdraw liquidity and reserve withdrawals. Update custody on deposits, withdrawals and liquidation; health checks use settled balances and liquidation share conversions use the pre-transfer exchange rate.
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

## Implemented: oracle validation and borrowing limits

- Oracle feed registration/replacement now requires an explicit positive `maxAge` in seconds per asset. Both administrative functions have a new three-argument ABI; old deployed oracles are incompatible with the updated scripts.
- Prices reject missing/future/stale timestamps, non-positive values, incomplete rounds and values that normalize to zero. Supported feed decimals are 0 through 18, normalized to 8; unsupported decimals and multiplication overflow are rejected.
- The mock feed now stores the actual update timestamp and advances its round on updates. It does not fabricate a fresh timestamp on reads. Mock stable feeds therefore expire unless updated and must not be used for mainnet.
- Borrowing and withdrawals with outstanding debt enforce weighted LTV as well as the liquidation threshold. Checks occur after token transfer so temporary cash/share balances cannot inflate collateral. Failed checks revert the entire transaction, including the transfer. Existing exact-transfer, non-rebasing token assumptions still apply.
- Liquidation continues to use the liquidation threshold, not LTV. Repayment does not require working oracle prices; after fully repaying, dedicated collateral can be withdrawn without prices. Accounts with debt cannot withdraw against stale relevant prices. Unused asset feeds are skipped in account valuation.
- The default one-hour ages in unit tests are fixtures, not recommended mainnet heartbeat settings.

Deployment/patch scripts now require the applicable variables `ORACLE_USDC_MAX_AGE`, `ORACLE_EURC_MAX_AGE`, and `ORACLE_CIRBTC_MAX_AGE` (seconds). Choose each from verified provider heartbeat/update guarantees and risk policy. There is no silent production default. Update admin tooling to the new ABI. New oracle/pool/vault deployment is required; do not run these updated patch scripts against legacy oracles.

Frontend follow-up: add user-facing messages for `BorrowLimitExceeded`, `StalePrice`, invalid timestamps/rounds/configuration and the revised invalid-price cases in `frontend/src/lib/lendingErrors.ts`; reconcile UI maximum-withdraw and maximum-borrow calculations with weighted LTV. No frontend deployment was performed here.

### Oracle/LTV validation (2026-09-22)

Before the fix, three regressions failed: above-LTV borrowing below the liquidation threshold was accepted, stale prices were accepted, and an 18-decimal price was not normalized. The final CI-profile run passed all 100 test executions across seven suites (including inherited baseline tests). Fuzz tests ran 1,000 cases each; all three existing vault invariants passed 100 runs / 50,000 calls each with zero reverts. The new suites cover LTV boundaries, borrowing against same-asset supply, withdrawal bypasses, stale-price rollback, repayment during an oracle outage, unrelated stale feeds, timestamp/round validation, decimal normalization and the Stork adapter.

Run from `contracts/` with `FOUNDRY_PROFILE=ci`:

```text
forge test --out out-risk --cache-path cache-risk -vv
forge build --out out-risk --cache-path cache-risk --sizes
```

The full build, including deployment/patch scripts, passed with Solidity 0.8.24 and the existing optimizer/via-IR settings. `PatchStableFeeds.s.sol` now registers/logs one mock at a time to avoid a compiler stack-depth error. Runtime sizes were 8,754 bytes for the pool, 1,895 for the oracle and 7,649 for the vault, below the build's size limits. Lint flagged the oracle's positive-checked signed-to-unsigned conversion and `uint112` reserve conversions in `VitaelPair.sol`. Follow-up inspection confirmed that the pair already checks both reserve bounds before casting; describing those conversions as unchecked was incorrect. A regression test now covers the boundary and overflow rejection.

These are local tests with mocks, not a mainnet fork test or an audit. Production heartbeat values and feed deployments remain unverified.

## Implemented: DEX fee custody and pause enforcement

- Pair reserves, swap liquidity and LP mint/burn claims now exclude `protocolFees0/1`. Pending treasury fees remain separate custodial balances. Collection transfers those claims without changing LP reserves or quotes (assuming no unrelated balance changes).
- `skim` can only transfer excess LP balances and `sync` cannot reclassify treasury claims as LP reserves. Total swap fee stays 30 bps; the configured 0–10 bps treasury portion is reserved when each swap happens.
- Pair `swap` now checks the factory pause flag, including calls that bypass the router. Factory pause blocks pair creation and swaps; exits and fee collection remain available. This is not a global freeze of all DEX operations.
- Router liquidity additions check both minimum amounts on every branch, including initial liquidity. The existing one-sided checks missed some invalid requests.
- `VitaelPair.sol` already had a correct `uint112` overflow guard. No economic change was made to that guard; comments explain the checked casts to the linter.

The new pair bytecode requires a new factory/pair deployment. Existing factory deployments embed old pair creation code and cannot create the fixed pair version. Coordinate factory/router/quoter/frontend/indexer addresses and any off-chain CREATE2 calculations. LP migration must use an explicit withdrawal/redeposit flow; no balances have been migrated. Raw pair balances now include treasury custody while `getReserves` exposes LP liquidity only, so analytics must label these totals distinctly.

Remaining DEX work includes independent review, malicious/nonstandard token behavior, broader multi-hop routing and economic attack simulations. Exact-transfer, non-rebasing tokens are still the supported accounting assumption.

### DEX validation (2026-09-22)

Four regressions failed on the original implementation: treasury fees were included in reserves, collecting fees changed reserves, swaps bypassed factory pause, and liquidity additions could violate a minimum amount. After the fix the complete CI-profile suite passed 117 test executions across nine suites, with no failures or skips. The 16 DEX tests cover fees, LP entry/exit, both swap directions, exact-output swaps, fee changes, pause/unpause, slippage/deadline rollback and overflow bounds. Fuzz tests ran 1,000 cases each. The new DEX invariant passed 100 runs / 50,000 calls across swaps, mint/burn, collection and skim/sync with zero reverts; all three existing vault invariants also passed.

Full build including scripts passed with size checks. Formatting and diff-whitespace checks passed. Remaining lint notices are the positive-checked oracle cast and unchecked return values on transfers of the known `MockERC20` in test code; production pair/router transfers use `SafeERC20`. No frontend or live-network tests were run for this change.

Run from `contracts/` with `FOUNDRY_PROFILE=ci`:

```text
forge test --out out-dex --cache-path cache-dex -vv
forge build --out out-dex --cache-path cache-dex --sizes
```

## Release blockers and file-level work

### New testnet deployment integration check (2026-09-23)

Read-only RPC checks confirmed chain 5042002 and pool `0x5a2c897eb87ec30045736aecb764f78e93501b84`, whose `oracle()` returns `0x7bac9c169329e05997f73efaa18ec6490e1156a2`. The selected lending broadcast contains 11 successful receipts and no pending transactions. A previously transcribed 41-hex-digit oracle address was incorrect; local contract/frontend environment files and the backend example were corrected using the broadcast and on-chain getter.

At inspection time, USDC/EURC price reads reverted with Stork `NotFound`; cirBTC reverted with `StalePrice`. All three tracked lending cash balances were zero. Price-dependent borrowing, collateral withdrawal and liquidation are not ready for wallet testing until valid current prices are available. No oracle configuration or price update transaction was sent.

The locally configured vault `0x78c1a89ba59f14542b16e81e60363b7a71e31a4b` still returns the historical pool `0xea282eea5bc90905c15df05ca43eea967bcde49f`; it has not migrated. Local DEX addresses also remain the historical set. Keep existing-position access distinct from testing the new deployment.

Frontend and MCP market reads now use tracked liquidity and exact redemption previews. The lend form requests withdrawal shares from the pool rather than using floating-point proportional conversion. Frontend account collateral is valued before liquidation-threshold weighting, and a remaining shortfall is displayed with continuing-debt disclosure. New pool/oracle errors have user-facing messages. Backend market `cash` now means tracked lending cash; `dedicatedCollateral` is reported separately, and lending TVL includes both custody categories but excludes unsolicited transfers. Existing stored snapshots retain their old semantics until a new snapshot is generated.

Backend/indexer runs on Railway according to the operator. Local `backend/.env.example` edits do not update Railway Variables. Configure all required indexer addresses there and check deployment block/checkpoint/history migration before restarting against the new pool. Remote environment state, database checkpoint and live frontend wallet flows have not been verified in this check. ABI support added here does not complete liquidation UI, multi-step transaction or price-outage end-to-end testing.

Validation passed: frontend, MCP and backend TypeScript checks; ESLint on the three changed frontend files; four new error-selector mapping checks; and a live read-only MCP `getMarkets` call returning zero supply/liquidity for all three markets. On request, local `backend/.env` was created with the new pool/oracle and existing testnet DEX/CCTP/token addresses. Supabase credentials and frontend URL remain template/local defaults; Railway configuration was not modified.

### Lending precision and liquidation changes (2026-09-23)

The pool now tracks lending cash independently of raw token balances, uses shared high-precision debt shares for individual and aggregate debt, and exposes exact supply/redeem/withdraw previews. Inbound transfers must be exact. Zero-share supplies revert; supplied collateral seized during liquidation burns shares rounded upward. Debt valuation rounds upward to prevent sub-USD-unit borrowing without collateral. Asset updates accrue the previous interest configuration before replacement and validate token decimals and basic risk bounds.

Liquidation quotes cap actual payment by the collateral available and the cash available to redeem supplied collateral. Empty or zero-output liquidation reverts; same-asset liquidation is supported. Close-factor rounding permits a final atomic unit of debt. `Liquidated` reports actual payment rather than the caller's requested maximum.

The selected deficit policy is **keep the debt recorded and report the shortfall, without automatic loss allocation**. `getAccountShortfall` and `AccountShortfall` provide an oracle-valued deficit in 8-decimal USD. Remaining debt continues accruing and stays in supplier accounting assets at face value. This is not a solvency repair: illiquidity, liquidation bonuses and dust can make actual recoveries lower than reported collateral claims. Independent economic review, a recovery/deficit operating policy and user-facing disclosure remain release blockers.

Pool/vault changes require new deployments and coordinated ABI updates. Consumers must use tracked cash and exact previews, query current debt rather than legacy snapshots, and display actual quoted liquidation payment and remaining shortfall. Unsolicited pool transfers are excluded from claims and cannot currently be recovered. Exact-transfer, non-rebasing tokens remain mandatory.

Seven regression tests reproduced failures before the fix (donation dilution/inflation, zero shares, phantom aggregate debt, overpayment for insufficient collateral, empty collateral liquidation and same-asset liquidation). Additional tests cover configuration updates, transfer fees, tiny debt valuation, rounded seizure and preservation of residual debt. A stateful handler exercises borrowing, repayment, supply, withdrawal, time and donation; it checks cash/claims conservation and debt-share reconciliation, then repays all borrowers after each generated sequence to check that aggregate debt reaches zero.

CI-profile validation passed **149 test executions across 11 suites**, with zero failures or skips (includes inherited baseline tests). Fuzz tests ran 1,000 cases each. The new lending invariant, existing DEX invariant and all three vault invariants each passed 100 runs / 50,000 calls with zero reverts. This is local mock-based validation, not a mainnet fork or independent audit.

The full build including deployment scripts passed with size checks: pool runtime 12,149 bytes and vault runtime 7,606 bytes. Formatting of changed Solidity files and diff-whitespace checks passed. Remaining lint notices concern the positive-checked oracle cast and unchecked known-mock transfers in existing DEX tests. No deployment, frontend end-to-end run or live-network transaction was performed.

Run from `contracts/` with `FOUNDRY_PROFILE=ci`:

```text
forge test --out out-precision --cache-path cache-precision -vv
forge build --out out-precision --cache-path cache-precision --sizes
```

| Priority | Files | Required change / acceptance criteria |
| --- | --- | --- |
| P0 | `contracts/src/VitaelOracle.sol`, `contracts/src/StorkPriceFeed.sol` | Timestamp/age/round validation and decimal normalization implemented. Still verify real mainnet feeds, identifiers, heartbeat and maximum-age policies; rehearse outage recovery and liquidation availability. |
| P0 | `contracts/src/VitaelLendingPool.sol` | LTV enforcement and settled-balance checks implemented for borrow and collateral/supply withdrawals. Precision, donation isolation, basic asset validation, collateral-capped liquidation and stateful accounting tests are implemented. Still require independent review, reserve/liquidation liquidity stress tests and an operating policy for unallocated bad debt. |
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
