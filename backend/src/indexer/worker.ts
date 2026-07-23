import {
  decodeEventLog,
  decodeFunctionData,
  formatUnits,
  type Address,
  type Hash,
  type Log,
} from "viem";
import { env } from "../config/env.js";
import { supabase } from "../lib/supabase.js";
import { arcClient } from "./client.js";
import {
  CONTRACTS,
  TOKENS,
  cctpAbi,
  erc20Abi,
  factoryAbi,
  lendingAbi,
  oracleAbi,
  pairAbi,
  tokenByAddress,
  type Token,
} from "./contracts.js";

const WORKER_KEY = `arc-${env.ARC_CHAIN_ID}-vitael-v2`;
const REORG_REWIND_BLOCKS = 25n;

type PairInfo = { address: Address; token0: Token; token1: Token };

type TransactionRow = {
  chain_id: number;
  transaction_hash: string;
  log_index: number;
  wallet_address: string | null;
  contract_address: string;
  action: string;
  token_in: string | null;
  token_out: string | null;
  amount_in: string | null;
  amount_out: string | null;
  amount_in_decimals: number | null;
  amount_out_decimals: number | null;
  status: "confirmed";
  block_number: string;
  block_hash: string;
  block_timestamp: string;
  metadata: Record<string, unknown>;
};

const lower = (value: Address | Hash) => value.toLowerCase();
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function requireToken(address: Address) {
  const token = tokenByAddress.get(address.toLowerCase());
  if (!token) throw new Error(`Unsupported indexed token: ${address}`);
  return token;
}

async function loadPairs(): Promise<PairInfo[]> {
  const count = await arcClient.readContract({
    address: CONTRACTS.dexFactory,
    abi: factoryAbi,
    functionName: "allPairsLength",
  });
  const addresses = await Promise.all(
    Array.from({ length: Number(count) }, (_, index) => arcClient.readContract({
      address: CONTRACTS.dexFactory,
      abi: factoryAbi,
      functionName: "allPairs",
      args: [BigInt(index)],
    })),
  );
  return Promise.all(addresses.map(async (address) => {
    const [token0Address, token1Address] = await Promise.all([
      arcClient.readContract({ address, abi: pairAbi, functionName: "token0" }),
      arcClient.readContract({ address, abi: pairAbi, functionName: "token1" }),
    ]);
    return { address, token0: requireToken(token0Address), token1: requireToken(token1Address) };
  }));
}

async function blockContext(blockNumber: bigint, cache: Map<bigint, { hash: Hash; timestamp: string }>) {
  const cached = cache.get(blockNumber);
  if (cached) return cached;
  const block = await arcClient.getBlock({ blockNumber });
  if (!block.hash) throw new Error(`Block ${blockNumber} has no hash`);
  const context = { hash: block.hash, timestamp: new Date(Number(block.timestamp) * 1000).toISOString() };
  cache.set(blockNumber, context);
  return context;
}

function baseRow(log: Log, context: { hash: Hash; timestamp: string }): TransactionRow {
  if (log.blockNumber === null || log.transactionHash === null || log.logIndex === null) {
    throw new Error("RPC returned an incomplete log");
  }
  return {
    chain_id: env.ARC_CHAIN_ID,
    transaction_hash: lower(log.transactionHash),
    log_index: log.logIndex,
    wallet_address: null,
    contract_address: lower(log.address),
    action: "",
    token_in: null,
    token_out: null,
    amount_in: null,
    amount_out: null,
    amount_in_decimals: null,
    amount_out_decimals: null,
    status: "confirmed",
    block_number: log.blockNumber.toString(),
    block_hash: lower(context.hash),
    block_timestamp: context.timestamp,
    metadata: {},
  };
}

function tokenInput(row: TransactionRow, token: Token, amount: bigint) {
  row.token_in = lower(token.address);
  row.amount_in = amount.toString();
  row.amount_in_decimals = token.decimals;
}

function tokenOutput(row: TransactionRow, token: Token, amount: bigint) {
  row.token_out = lower(token.address);
  row.amount_out = amount.toString();
  row.amount_out_decimals = token.decimals;
}

function decodeLending(log: Log, context: { hash: Hash; timestamp: string }) {
  const decoded = decodeEventLog({ abi: lendingAbi, data: log.data, topics: log.topics, strict: true });
  const args = decoded.args as Record<string, Address | bigint>;
  const row = baseRow(log, context);

  if (decoded.eventName === "Liquidated") {
    const debt = requireToken(args.debtAsset as Address);
    const collateral = requireToken(args.collateralAsset as Address);
    row.action = "liquidate";
    row.wallet_address = lower(args.borrower as Address);
    tokenInput(row, debt, args.repaidAmount as bigint);
    tokenOutput(row, collateral, args.seizedCollateral as bigint);
    row.metadata = { liquidator: lower(args.liquidator as Address) };
    return row;
  }

  const token = requireToken(args.asset as Address);
  row.wallet_address = lower(args.user as Address);
  switch (decoded.eventName) {
    case "Supplied":
      row.action = "supply";
      tokenInput(row, token, args.amount as bigint);
      row.metadata = { shares: (args.shares as bigint).toString() };
      break;
    case "Withdrawn":
      row.action = "withdraw";
      tokenOutput(row, token, args.amount as bigint);
      row.metadata = { shares: (args.shares as bigint).toString() };
      break;
    case "CollateralDeposited":
      row.action = "deposit_collateral";
      tokenInput(row, token, args.amount as bigint);
      break;
    case "CollateralWithdrawn":
      row.action = "withdraw_collateral";
      tokenOutput(row, token, args.amount as bigint);
      break;
    case "Borrowed":
      row.action = "borrow";
      tokenOutput(row, token, args.amount as bigint);
      break;
    case "Repaid":
      row.action = "repay";
      tokenInput(row, token, args.amount as bigint);
      break;
    default:
      return null;
  }
  return row;
}

function decodePair(log: Log, pair: PairInfo, context: { hash: Hash; timestamp: string }) {
  const decoded = decodeEventLog({ abi: pairAbi, data: log.data, topics: log.topics, strict: true });
  const args = decoded.args as Record<string, Address | bigint>;
  const row = baseRow(log, context);
  row.metadata = { pair: lower(pair.address), token0: pair.token0.symbol, token1: pair.token1.symbol };

  if (decoded.eventName === "Swap") {
    row.action = "swap";
    row.wallet_address = lower(args.to as Address);
    if ((args.amount0In as bigint) > 0n) {
      tokenInput(row, pair.token0, args.amount0In as bigint);
      tokenOutput(row, pair.token1, args.amount1Out as bigint);
    } else {
      tokenInput(row, pair.token1, args.amount1In as bigint);
      tokenOutput(row, pair.token0, args.amount0Out as bigint);
    }
    row.metadata.sender = lower(args.sender as Address);
    return row;
  }
  if (decoded.eventName === "Mint") {
    row.action = "add_liquidity";
    row.wallet_address = lower(args.sender as Address);
    tokenInput(row, pair.token0, args.amount0 as bigint);
    tokenOutput(row, pair.token1, args.amount1 as bigint);
    return row;
  }
  if (decoded.eventName === "Burn") {
    row.action = "remove_liquidity";
    row.wallet_address = lower(args.to as Address);
    tokenInput(row, pair.token0, args.amount0 as bigint);
    tokenOutput(row, pair.token1, args.amount1 as bigint);
    row.metadata.sender = lower(args.sender as Address);
    return row;
  }
  return null;
}

async function scanRange(fromBlock: bigint, toBlock: bigint, pairs: PairInfo[]) {
  const pairByAddress = new Map(pairs.map((pair) => [lower(pair.address), pair]));
  const [lendingLogs, pairLogs, bridgeLogs] = await Promise.all([
    arcClient.getLogs({ address: CONTRACTS.lendingPool, fromBlock, toBlock }),
    pairs.length === 0
      ? Promise.resolve([])
      : arcClient.getLogs({ address: pairs.map((pair) => pair.address), fromBlock, toBlock }),
    arcClient.getLogs({ address: CONTRACTS.cctpMessageTransmitter, fromBlock, toBlock }),
  ]);
  const cache = new Map<bigint, { hash: Hash; timestamp: string }>();
  const senderCache = new Map<Hash, Address>();
  const rows: TransactionRow[] = [];

  for (const log of lendingLogs) {
    if (log.blockNumber === null) continue;
    try {
      const row = decodeLending(log, await blockContext(log.blockNumber, cache));
      if (row) rows.push(row);
    } catch {
      // The pool also emits configuration/interest events that are not user transactions.
      continue;
    }
  }
  for (const log of pairLogs) {
    if (log.blockNumber === null) continue;
    const pair = pairByAddress.get(lower(log.address));
    if (!pair) continue;
    try {
      const row = decodePair(log, pair, await blockContext(log.blockNumber, cache));
      if (row && log.transactionHash) {
        const recipient = row.wallet_address;
        let sender = senderCache.get(log.transactionHash);
        if (!sender) {
          sender = (await arcClient.getTransaction({ hash: log.transactionHash })).from;
          senderCache.set(log.transactionHash, sender);
        }
        row.wallet_address = lower(sender);
        row.metadata.recipient = recipient;
        rows.push(row);
      }
    } catch {
      // Pair contracts also emit ERC-20 Transfer/Approval and reserve Sync events.
      continue;
    }
  }

  for (const log of bridgeLogs) {
    if (log.blockNumber === null || !log.transactionHash) continue;
    try {
      decodeEventLog({ abi: cctpAbi, data: log.data, topics: log.topics, strict: true });
      const transaction = await arcClient.getTransaction({ hash: log.transactionHash });
      if (!transaction.to || lower(transaction.to) !== lower(CONTRACTS.cctpTokenMessenger)) continue;
      const call = decodeFunctionData({ abi: cctpAbi, data: transaction.input });
      if (call.functionName !== "depositForBurnWithHook") continue;
      const [amount, destinationDomain, mintRecipient, burnToken, , maxFee, minFinalityThreshold] = call.args;
      const token = requireToken(burnToken);
      const row = baseRow(log, await blockContext(log.blockNumber, cache));
      row.action = "bridge";
      row.wallet_address = lower(transaction.from);
      tokenInput(row, token, amount);
      row.metadata = {
        direction: "outbound",
        destination_domain: destinationDomain,
        mint_recipient: `0x${mintRecipient.slice(-40)}`.toLowerCase(),
        max_fee: maxFee.toString(),
        min_finality_threshold: minFinalityThreshold,
      };
      rows.push(row);
    } catch {
      // MessageTransmitter emits messages for operations other than Vitael bridge burns.
      continue;
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("transactions")
      .upsert(rows, { onConflict: "chain_id,transaction_hash,log_index" });
    if (error) throw new Error(`Supabase transaction upsert failed: ${error.message}`);
  }
  return rows.length;
}

async function checkpoint() {
  const { data, error } = await supabase.from("indexer_state")
    .select("last_processed_block,last_processed_block_hash")
    .eq("worker_key", WORKER_KEY).maybeSingle();
  if (error) throw new Error(`Unable to read indexer checkpoint: ${error.message}`);
  if (data) return {
    block: BigInt(data.last_processed_block),
    hash: data.last_processed_block_hash as Hash | null,
  };
  const block = BigInt(env.INDEXER_START_BLOCK) - 1n;
  const { error: insertError } = await supabase.from("indexer_state").insert({
    worker_key: WORKER_KEY,
    chain_id: env.ARC_CHAIN_ID,
    last_processed_block: block.toString(),
    status: "idle",
  });
  if (insertError) throw new Error(`Unable to create indexer checkpoint: ${insertError.message}`);
  return { block, hash: null };
}

async function saveCheckpoint(block: bigint, hash: Hash, status: "idle" | "syncing" | "error", errorMessage?: string) {
  const { error } = await supabase.from("indexer_state").update({
    last_processed_block: block.toString(),
    last_processed_block_hash: lower(hash),
    status,
    error_message: errorMessage ?? null,
  }).eq("worker_key", WORKER_KEY);
  if (error) throw new Error(`Unable to save indexer checkpoint: ${error.message}`);
}

async function verifyCheckpoint(state: { block: bigint; hash: Hash | null }) {
  if (!state.hash || state.block < BigInt(env.INDEXER_START_BLOCK)) return state;
  const current = await arcClient.getBlock({ blockNumber: state.block });
  if (current.hash && lower(current.hash) === lower(state.hash)) return state;

  const rewind = state.block > REORG_REWIND_BLOCKS ? state.block - REORG_REWIND_BLOCKS : 0n;
  const rewindBlock = await arcClient.getBlock({ blockNumber: rewind });
  if (!rewindBlock.hash) throw new Error("Cannot recover from chain reorganization");
  const { error } = await supabase.from("transactions").update({ status: "reorged" })
    .eq("chain_id", env.ARC_CHAIN_ID).gt("block_number", rewind.toString());
  if (error) throw new Error(`Unable to mark reorged rows: ${error.message}`);
  await saveCheckpoint(rewind, rewindBlock.hash, "syncing");
  console.warn(`[indexer] reorg detected; rewound to block ${rewind}`);
  return { block: rewind, hash: rewindBlock.hash };
}

const toUsd = (amount: bigint, token: Token, price: bigint) =>
  Number(formatUnits(amount, token.decimals)) * Number(price) / 1e8;

async function captureSnapshot(blockNumber: bigint, pairs: PairInfo[]) {
  const prices = new Map<string, bigint>();
  await Promise.all(TOKENS.map(async (token) => {
    const price = await arcClient.readContract({
      address: CONTRACTS.oracle,
      abi: oracleAbi,
      functionName: "getAssetPrice",
      args: [token.address],
      blockNumber,
    });
    prices.set(lower(token.address), price);
  }));

  let lendingTvl = 0;
  let totalSupplied = 0;
  let totalBorrowed = 0;
  const markets: Record<string, unknown> = {};
  for (const token of TOKENS) {
    const [cash, state, exchangeRate] = await Promise.all([
      arcClient.readContract({ address: token.address, abi: erc20Abi, functionName: "balanceOf", args: [CONTRACTS.lendingPool], blockNumber }),
      arcClient.readContract({ address: CONTRACTS.lendingPool, abi: lendingAbi, functionName: "assetStates", args: [token.address], blockNumber }),
      arcClient.readContract({ address: CONTRACTS.lendingPool, abi: lendingAbi, functionName: "exchangeRate", args: [token.address], blockNumber }),
    ]);
    const [borrowed, reserves, , , shares] = state;
    const supplied = shares * exchangeRate / 10n ** 18n;
    const price = prices.get(lower(token.address)) ?? 0n;
    const cashUsd = toUsd(cash, token, price);
    const suppliedUsd = toUsd(supplied, token, price);
    const borrowedUsd = toUsd(borrowed, token, price);
    lendingTvl += cashUsd;
    totalSupplied += suppliedUsd;
    totalBorrowed += borrowedUsd;
    markets[token.symbol] = {
      address: lower(token.address), cash: cash.toString(), supplied: supplied.toString(),
      borrowed: borrowed.toString(), reserves: reserves.toString(), price8: price.toString(),
    };
  }

  let dexTvl = 0;
  const dexMarkets: Record<string, unknown> = {};
  for (const pair of pairs) {
    const [reserve0, reserve1] = await arcClient.readContract({
      address: pair.address, abi: pairAbi, functionName: "getReserves", blockNumber,
    });
    const reserve0Usd = toUsd(reserve0, pair.token0, prices.get(lower(pair.token0.address)) ?? 0n);
    const reserve1Usd = toUsd(reserve1, pair.token1, prices.get(lower(pair.token1.address)) ?? 0n);
    dexTvl += reserve0Usd + reserve1Usd;
    dexMarkets[`${pair.token0.symbol}/${pair.token1.symbol}`] = {
      address: lower(pair.address), reserve0: reserve0.toString(), reserve1: reserve1.toString(),
    };
  }

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data: swaps, error: swapsError } = await supabase.from("transactions")
    .select("token_in,amount_in,amount_in_decimals")
    .eq("chain_id", env.ARC_CHAIN_ID).eq("action", "swap").gte("block_timestamp", since).limit(10_000);
  if (swapsError) throw new Error(`Unable to calculate volume: ${swapsError.message}`);
  const swapVolume = swaps.reduce((sum, swap) => {
    const token = tokenByAddress.get(String(swap.token_in).toLowerCase());
    const price = token ? prices.get(lower(token.address)) : undefined;
    return token && price ? sum + toUsd(BigInt(swap.amount_in), token, price) : sum;
  }, 0);

  const utilization = totalSupplied > 0 ? totalBorrowed / totalSupplied * 100 : null;
  const block = await arcClient.getBlock({ blockNumber });
  const capturedAt = new Date(Number(block.timestamp) * 1000).toISOString();
  const { error } = await supabase.from("protocol_snapshots").upsert({
    chain_id: env.ARC_CHAIN_ID,
    block_number: blockNumber.toString(),
    tvl_usd: (lendingTvl + dexTvl).toFixed(8),
    total_supplied_usd: totalSupplied.toFixed(8),
    total_borrowed_usd: totalBorrowed.toFixed(8),
    swap_volume_usd: swapVolume.toFixed(8),
    utilization: utilization?.toFixed(6) ?? null,
    markets: { lending: markets, dex: dexMarkets, lending_tvl_usd: lendingTvl, dex_tvl_usd: dexTvl },
    captured_at: capturedAt,
  }, { onConflict: "chain_id,block_number" });
  if (error) throw new Error(`Supabase snapshot upsert failed: ${error.message}`);
  console.log(`[indexer] snapshot block=${blockNumber} tvl=$${(lendingTvl + dexTvl).toFixed(2)}`);
}

export async function runIndexer(signal: AbortSignal) {
  let pairs = await loadPairs();
  let state = await verifyCheckpoint(await checkpoint());
  let lastSnapshotAt = 0;
  let pairRefreshAt = Date.now();
  console.log(`[indexer] started at block ${state.block + 1n}; ${pairs.length} DEX pair(s)`);

  // Publish current analytics immediately; historical transaction backfill can continue afterwards.
  try {
    const latest = await arcClient.getBlockNumber();
    const confirmedHead = latest - BigInt(env.INDEXER_CONFIRMATIONS);
    await captureSnapshot(confirmedHead, pairs);
    lastSnapshotAt = Date.now();
  } catch (error) {
    console.error("[indexer] initial snapshot failed", error);
  }

  while (!signal.aborted) {
    try {
      if (Date.now() - pairRefreshAt > 60_000) {
        pairs = await loadPairs();
        pairRefreshAt = Date.now();
      }
      const latest = await arcClient.getBlockNumber();
      const confirmedHead = latest > BigInt(env.INDEXER_CONFIRMATIONS)
        ? latest - BigInt(env.INDEXER_CONFIRMATIONS) : 0n;
      let next = state.block + 1n;
      while (next <= confirmedHead && !signal.aborted) {
        const to = next + BigInt(env.INDEXER_BLOCK_CHUNK - 1) < confirmedHead
          ? next + BigInt(env.INDEXER_BLOCK_CHUNK - 1) : confirmedHead;
        const count = await scanRange(next, to, pairs);
        const block = await arcClient.getBlock({ blockNumber: to });
        if (!block.hash) throw new Error(`Block ${to} has no hash`);
        await saveCheckpoint(to, block.hash, to < confirmedHead ? "syncing" : "idle");
        state = { block: to, hash: block.hash };
        console.log(`[indexer] blocks ${next}-${to}, ${count} event(s)`);
        next = to + 1n;
      }
      if (confirmedHead > 0n && Date.now() - lastSnapshotAt >= env.SNAPSHOT_INTERVAL_MS) {
        await captureSnapshot(confirmedHead, pairs);
        lastSnapshotAt = Date.now();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[indexer]", message);
      if (state.hash) {
        await saveCheckpoint(state.block, state.hash, "error", message.slice(0, 1000)).catch(console.error);
      }
    }
    await sleep(env.INDEXER_POLL_INTERVAL_MS);
  }
}
