"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplets, Minus, ChevronDown, Wallet, ExternalLink } from "lucide-react";
import TxStatusBanner from "../../components/TxStatusBanner";
import { useAccount } from "wagmi";
import WalletConnectButton from "../../components/WalletConnectButton";
import { formatUnits } from "viem";
import { formatTokenAmount } from "../../lib/format";
import PageLayout from "../../components/PageLayout";
import TokenIcon from "../../components/TokenIcon";
import NetworkGuard from "../../components/NetworkGuard";
import { useVitaelDEX, type TokenSymbol, TOKENS } from "../../hooks/useVitaelDEX";

type Tab = "add" | "remove";
const TOKEN_LIST = Object.values(TOKENS);

// ─── Token selector ───────────────────────────────────────────────────────────
function TokenSelector({ selected, onSelect, exclude }: {
  selected: TokenSymbol; onSelect: (t: TokenSymbol) => void; exclude?: TokenSymbol;
}) {
  const [open, setOpen] = useState(false);
  const token = TOKENS[selected];
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 transition min-w-[110px]">
        <TokenIcon symbol={token.symbol} size={22} />
        <span className="font-bold text-white text-sm">{token.symbol}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#8991AF] ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
            className="absolute top-full mt-1.5 left-0 z-40 glass-panel rounded-2xl overflow-hidden w-44 shadow-2xl">
            {TOKEN_LIST.filter(t => t.symbol !== exclude).map(t => (
              <button key={t.symbol} onClick={() => { onSelect(t.symbol as TokenSymbol); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left">
                <TokenIcon symbol={t.symbol} size={26} />
                <div>
                  <p className="text-sm font-bold text-white">{t.symbol}</p>
                  <p className="text-xs text-[#8991AF]">{t.name}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const POOL_STEP_LABELS: Record<string, string> = {
  switching: "Switching to Arc Testnet...",
  approving: "Approving — sign in wallet...",
  adding: "Adding liquidity — sign in wallet...",
  removing: "Removing liquidity — sign in wallet...",
  confirming: "Waiting for confirmation...",
};

// ─── Add Liquidity Panel ──────────────────────────────────────────────────────
function AddPanel() {
  const { isConnected, address } = useAccount();
  const { state, addLiquidity, getPoolInfo, reset } = useVitaelDEX();

  const [tokenA,  setTokenA]  = useState<TokenSymbol>("USDC");
  const [tokenB,  setTokenB]  = useState<TokenSymbol>("EURC");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [poolInfo, setPoolInfo] = useState<Awaited<ReturnType<typeof getPoolInfo>>>(null);

  const busy = state.busy;
  const tA = TOKENS[tokenA];
  const tB = TOKENS[tokenB];

  // Validation
  const amtA = parseFloat(amountA) || 0;
  const amtB = parseFloat(amountB) || 0;
  const balA = poolInfo ? parseFloat(formatUnits(poolInfo.balanceA, tA.decimals)) : 0;
  const balB = poolInfo ? parseFloat(formatUnits(poolInfo.balanceB, tB.decimals)) : 0;
  const insufficientA = amtA > balA;
  const insufficientB = amtB > balB;

  useEffect(() => {
    if (!address) return;
    getPoolInfo(tokenA, tokenB, address).then(setPoolInfo);
  }, [tokenA, tokenB, address, getPoolInfo, state.step]);

  // Auto-fill tokenB based on pool ratio when user types tokenA
  function handleAmountAChange(val: string) {
    setAmountA(val);
    reset();
    if (!poolInfo || !val || parseFloat(val) <= 0) return;
    const r0 = poolInfo.token0.toLowerCase() === tA.address.toLowerCase() ? poolInfo.reserve0 : poolInfo.reserve1;
    const r1 = poolInfo.token0.toLowerCase() === tA.address.toLowerCase() ? poolInfo.reserve1 : poolInfo.reserve0;
    if (r0 === 0n) return;
    const aIn = BigInt(Math.floor(parseFloat(val) * 10 ** tA.decimals));
    setAmountB(formatUnits((aIn * r1) / r0, tB.decimals));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-white text-lg">Add Liquidity</h2>
        <div className="flex gap-1.5">
          {[0.5, 1.0].map(v => (
            <button key={v} onClick={() => setSlippage(v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${slippage === v ? "bg-[#A998FF] text-[#0D0E1E]" : "bg-white/5 text-[#8991AF] hover:bg-white/10"}`}>
              {v}% slip
            </button>
          ))}
        </div>
      </div>

      {poolInfo && (
        <div className="bg-white/2 rounded-xl p-3 mb-4 text-xs space-y-1.5">
          <p className="text-[#8991AF] uppercase tracking-wider font-semibold mb-1">Pool Info</p>
          <div className="flex justify-between">
            <span className="text-[#8991AF]">{tA.symbol} reserve</span>
            <span className="text-white">{formatTokenAmount(formatUnits(poolInfo.token0.toLowerCase() === tA.address.toLowerCase() ? poolInfo.reserve0 : poolInfo.reserve1, tA.decimals))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8991AF]">{tB.symbol} reserve</span>
            <span className="text-white">{formatTokenAmount(formatUnits(poolInfo.token0.toLowerCase() === tA.address.toLowerCase() ? poolInfo.reserve1 : poolInfo.reserve0, tB.decimals))}</span>
          </div>
          {poolInfo.userLpBalance > 0n && (
            <div className="flex justify-between pt-1 border-t border-white/5">
              <span className="text-[#8991AF]">Your LP</span>
              <span className="text-[#A998FF] font-semibold">{formatTokenAmount(formatUnits(poolInfo.userLpBalance, 18), { min: 6, max: 10 })}</span>
            </div>
          )}
        </div>
      )}

      <div className="bg-black/30 border border-white/5 focus-within:border-[#A998FF]/30 rounded-2xl p-4 mb-2 transition">
        <p className="text-xs text-[#8991AF] uppercase tracking-wider mb-3">Token A</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            placeholder="0.00"
            value={amountA}
            disabled={busy}
            onChange={e => {
              const val = e.target.value;
              if (val && parseFloat(val) < 0) return;
              handleAmountAChange(val);
            }}
            onBlur={() => {
              if (!amountA || !poolInfo) return;
              const val = parseFloat(amountA);
              const maxBal = parseFloat(formatUnits(poolInfo.balanceA, tA.decimals));
              if (val > maxBal) handleAmountAChange(maxBal.toString());
            }}
            className="flex-1 bg-transparent text-2xl font-bold text-white outline-none placeholder-white/20 disabled:opacity-50"
          />
          <TokenSelector selected={tokenA} onSelect={s => { setTokenA(s); setAmountA(""); setAmountB(""); }} exclude={tokenB} />
        </div>
        {poolInfo && (
          <div className="flex justify-between mt-2 text-xs text-[#8991AF]">
            <span>Balance: {parseFloat(formatUnits(poolInfo.balanceA, tA.decimals)).toFixed(4)} {tokenA}</span>
            <button
              className="text-[#A998FF] hover:underline"
              onClick={() => handleAmountAChange(formatUnits(poolInfo.balanceA, tA.decimals))}
            >
              MAX
            </button>
          </div>
        )}
        {insufficientA && amountA && (
          <p className="text-xs text-red-400 mt-1">Insufficient {tokenA} balance</p>
        )}
      </div>

      <div className="flex justify-center my-1">
        <div className="w-9 h-9 rounded-full bg-[#0D0E1E] border border-white/10 flex items-center justify-center text-[#8991AF]">
          <Droplets className="w-4 h-4" />
        </div>
      </div>

      <div className="bg-black/30 border border-white/5 focus-within:border-[#A998FF]/30 rounded-2xl p-4 mb-5 transition">
        <p className="text-xs text-[#8991AF] uppercase tracking-wider mb-3">Token B</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            placeholder="0.00"
            value={amountB}
            disabled={busy}
            onChange={e => {
              const val = e.target.value;
              if (val && parseFloat(val) < 0) return;
              setAmountB(val);
              reset();
            }}
            onBlur={() => {
              if (!amountB || !poolInfo) return;
              const val = parseFloat(amountB);
              const maxBal = parseFloat(formatUnits(poolInfo.balanceB, tB.decimals));
              if (val > maxBal) setAmountB(maxBal.toString());
            }}
            className="flex-1 bg-transparent text-2xl font-bold text-white outline-none placeholder-white/20 disabled:opacity-50"
          />
          <TokenSelector selected={tokenB} onSelect={s => { setTokenB(s); setAmountA(""); setAmountB(""); }} exclude={tokenA} />
        </div>
        {poolInfo && (
          <div className="flex justify-between mt-2 text-xs text-[#8991AF]">
            <span>Balance: {parseFloat(formatUnits(poolInfo.balanceB, tB.decimals)).toFixed(4)} {tokenB}</span>
            <button
              className="text-[#A998FF] hover:underline"
              onClick={() => setAmountB(formatUnits(poolInfo.balanceB, tB.decimals))}
            >
              MAX
            </button>
          </div>
        )}
        {insufficientB && amountB && (
          <p className="text-xs text-red-400 mt-1">Insufficient {tokenB} balance</p>
        )}
      </div>

      <TxStatusBanner step={state.step} error={state.error} txHash={state.txHash} stepLabels={POOL_STEP_LABELS} />

      {!isConnected ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-sm text-[#8991AF] flex items-center gap-2"><Wallet className="w-4 h-4" />Connect wallet</p>
          <WalletConnectButton />
        </div>
      ) : state.step === "done" ? (
        <button onClick={() => { reset(); setAmountA(""); setAmountB(""); }}
          className="app-button app-button-secondary w-full bg-white/5 border border-white/10 text-white font-semibold py-3.5 rounded-xl hover:bg-white/10 transition">Add More</button>
      ) : (
        <button onClick={() => addLiquidity(tokenA, tokenB, amountA, amountB, slippage)}
          disabled={busy || !amountA || !amountB || parseFloat(amountA) <= 0 || insufficientA || insufficientB}
          className="app-button app-button-primary w-full bg-emerald-400 text-[#0D0E1E] font-bold py-3.5 rounded-xl hover:bg-emerald-300 transition disabled:opacity-40 flex items-center justify-center gap-2">
          {busy ? <><div className="w-5 h-5 border-2 border-[#0D0E1E]/30 border-t-[#0D0E1E] rounded-full animate-spin" />Processing...</>
            : <><Droplets className="w-4 h-4" />Add {tokenA} / {tokenB} Liquidity</>}
        </button>
      )}
    </div>
  );
}

// ─── Remove Liquidity Panel ───────────────────────────────────────────────────
function RemovePanel() {
  const { isConnected, address } = useAccount();
  const { state, removeLiquidity, getPoolInfo, reset } = useVitaelDEX();

  const [tokenA,   setTokenA]   = useState<TokenSymbol>("USDC");
  const [tokenB,   setTokenB]   = useState<TokenSymbol>("EURC");
  const [lpAmount, setLpAmount] = useState("");
  const [pct,      setPct]      = useState(100);
  const [poolInfo, setPoolInfo] = useState<Awaited<ReturnType<typeof getPoolInfo>>>(null);

  const busy = state.busy;
  const tA = TOKENS[tokenA];
  const tB = TOKENS[tokenB];

  useEffect(() => {
    if (!address) return;
    getPoolInfo(tokenA, tokenB, address).then(setPoolInfo);
  }, [tokenA, tokenB, address, getPoolInfo, state.step]);

  function handlePct(p: number) {
    setPct(p);
    if (!poolInfo || poolInfo.userLpBalance === 0n) return;
    setLpAmount(formatUnits(poolInfo.userLpBalance * BigInt(p) / 100n, 18));
  }

  let estA = "—", estB = "—";
  if (poolInfo && poolInfo.totalSupply > 0n && lpAmount && parseFloat(lpAmount) > 0) {
    try {
      const lp = BigInt(Math.floor(parseFloat(lpAmount) * 1e18));
      const r0 = poolInfo.token0.toLowerCase() === tA.address.toLowerCase() ? poolInfo.reserve0 : poolInfo.reserve1;
      const r1 = poolInfo.token0.toLowerCase() === tA.address.toLowerCase() ? poolInfo.reserve1 : poolInfo.reserve0;
      estA = parseFloat(formatUnits(lp * r0 / poolInfo.totalSupply, tA.decimals)).toFixed(6);
      estB = parseFloat(formatUnits(lp * r1 / poolInfo.totalSupply, tB.decimals)).toFixed(6);
    } catch { /* ignore */ }
  }

  return (
    <div>
      <h2 className="font-bold text-white text-lg mb-5">Remove Liquidity</h2>

      <div className="flex items-center gap-3 mb-4">
        <TokenSelector selected={tokenA} onSelect={s => { setTokenA(s); setLpAmount(""); reset(); }} exclude={tokenB} />
        <span className="text-[#8991AF] font-bold">/</span>
        <TokenSelector selected={tokenB} onSelect={s => { setTokenB(s); setLpAmount(""); reset(); }} exclude={tokenA} />
      </div>

      {poolInfo ? (
        <div className="bg-white/2 rounded-xl p-3 mb-4 text-xs">
          <div className="flex justify-between mb-3">
            <span className="text-[#8991AF]">Your LP balance</span>
            <span className="text-white font-semibold">{parseFloat(formatUnits(poolInfo.userLpBalance, 18)).toFixed(6)}</span>
          </div>
          <div className="flex gap-2">
            {[25, 50, 75, 100].map(p => (
              <button key={p} onClick={() => handlePct(p)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${pct === p ? "bg-[#A998FF] text-[#0D0E1E]" : "bg-white/5 text-[#8991AF] hover:bg-white/10"}`}>
                {p}%
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white/2 rounded-xl p-3 mb-4 text-xs text-[#8991AF]">
          {address ? "No LP position found for this pair." : "Connect wallet to see your positions."}
        </div>
      )}

      <div className="bg-black/30 border border-white/5 focus-within:border-[#A998FF]/30 rounded-2xl p-4 mb-4 transition">
        <p className="text-xs text-[#8991AF] uppercase tracking-wider mb-3">LP Token Amount</p>
        <input
          type="number"
          placeholder="0.00"
          value={lpAmount}
          disabled={busy}
          onChange={e => {
            const val = e.target.value;
            if (val && parseFloat(val) < 0) return;
            setLpAmount(val);
            setPct(0);
            reset();
          }}
          onBlur={() => {
            if (!lpAmount || !poolInfo) return;
            const val = parseFloat(lpAmount);
            const maxBal = parseFloat(formatUnits(poolInfo.userLpBalance, 18));
            if (val > maxBal) setLpAmount(maxBal.toString());
          }}
          className="w-full bg-transparent text-2xl font-bold text-white outline-none placeholder-white/20 disabled:opacity-50"
        />
        {poolInfo && poolInfo.userLpBalance > 0n && (
          <div className="flex justify-between mt-2 text-xs text-[#8991AF]">
            <span>Available: {parseFloat(formatUnits(poolInfo.userLpBalance, 18)).toFixed(6)} LP</span>
            <button
              className="text-[#A998FF] hover:underline"
              onClick={() => handlePct(100)}
            >
              MAX
            </button>
          </div>
        )}
      </div>

      {lpAmount && parseFloat(lpAmount) > 0 && (
        <div className="bg-white/2 rounded-xl p-3 mb-4 text-xs space-y-1.5">
          <p className="text-[#8991AF] uppercase tracking-wider font-semibold mb-1">You will receive</p>
          <div className="flex justify-between">
            <span className="flex items-center gap-1.5"><TokenIcon symbol={tA.symbol} size={14} />{tA.symbol}</span>
            <span className="text-white font-semibold">{estA}</span>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-1.5"><TokenIcon symbol={tB.symbol} size={14} />{tB.symbol}</span>
            <span className="text-white font-semibold">{estB}</span>
          </div>
        </div>
      )}

      <TxStatusBanner step={state.step} error={state.error} txHash={state.txHash} stepLabels={POOL_STEP_LABELS} />

      {!isConnected ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-sm text-[#8991AF] flex items-center gap-2"><Wallet className="w-4 h-4" />Connect wallet</p>
          <WalletConnectButton />
        </div>
      ) : state.step === "done" ? (
        <button onClick={() => { reset(); setLpAmount(""); setPct(100); }}
          className="app-button app-button-secondary w-full bg-white/5 border border-white/10 text-white font-semibold py-3.5 rounded-xl hover:bg-white/10 transition">Remove More</button>
      ) : (
        <button onClick={() => removeLiquidity(tokenA, tokenB, lpAmount, 0.5)}
          disabled={busy || !lpAmount || parseFloat(lpAmount) <= 0 || !poolInfo}
          className="app-button app-button-danger w-full bg-red-400/80 text-white font-bold py-3.5 rounded-xl hover:bg-red-400 transition disabled:opacity-40 flex items-center justify-center gap-2">
          {busy ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
            : <><Minus className="w-4 h-4" />Remove Liquidity</>}
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PoolPage() {
  const [tab, setTab] = useState<Tab>("add");

  return (
    <PageLayout variant="app">
      <main className="app-page relative z-10 max-w-5xl mx-auto px-6 py-12">

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <span className="app-eyebrow text-xs uppercase tracking-widest text-[#A998FF] font-bold mb-2 block">Arc Testnet · Vitael DEX V2</span>
          <h1 className="app-page-title text-5xl text-white">Liquidity</h1>
          <p className="text-[#8991AF] mt-2 text-sm">Provide liquidity to earn 0.3% fees on every swap. You sign all transactions in your wallet.</p>
        </motion.div>

        <NetworkGuard>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="app-action-panel lg:col-span-3 glass-panel rounded-3xl p-6 relative">
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-emerald-400/4 rounded-full blur-3xl pointer-events-none overflow-hidden" />

            {/* Tab bar */}
            <div className="flex gap-1 bg-white/3 rounded-2xl p-1 mb-6">
              {([
                { id: "add" as Tab,    label: "Add Liquidity",    icon: <Droplets className="w-4 h-4" /> },
                { id: "remove" as Tab, label: "Remove Liquidity", icon: <Minus className="w-4 h-4" /> },
              ]).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition ${
                    tab === t.id ? "bg-[#A998FF] text-[#0D0E1E] shadow-lg" : "text-[#8991AF] hover:text-white"
                  }`}>
                  {t.icon}<span>{t.label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                {tab === "add"    && <AddPanel />}
                {tab === "remove" && <RemovePanel />}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Right panel */}
          <div className="lg:col-span-2 space-y-5">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
              className="glass-panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-wider text-[#8991AF] mb-4">Available Pools</p>
              <div className="space-y-3">
                {[{ a: "USDC", b: "EURC", fee: "0.3%" }, { a: "USDC", b: "cirBTC", fee: "0.3%" }].map(p => (
                  <div key={`${p.a}-${p.b}`} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        <TokenIcon symbol={p.a} size={24} />
                        <TokenIcon symbol={p.b} size={24} />
                      </div>
                      <span className="text-sm font-bold text-white">{p.a}/{p.b}</span>
                    </div>
                    <span className="text-xs text-[#A998FF] font-semibold bg-[#A998FF]/10 px-2 py-0.5 rounded-full">{p.fee} fee</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="glass-panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-wider text-[#A998FF] font-bold mb-3">How it works</p>
              <div className="space-y-3">
                {[
                  { n: "1", t: "Deposit tokens", d: "Add equal value of two tokens to a pool." },
                  { n: "2", t: "Earn fees",      d: "Receive 0.3% of every swap in your pool." },
                  { n: "3", t: "Withdraw",       d: "Remove liquidity anytime and collect fees." },
                ].map(s => (
                  <div key={s.n} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#A998FF]/10 border border-[#A998FF]/20 flex items-center justify-center text-xs font-bold text-[#A998FF] flex-shrink-0 mt-0.5">{s.n}</div>
                    <div><p className="text-sm font-bold text-white">{s.t}</p><p className="text-xs text-[#8991AF] mt-0.5">{s.d}</p></div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
              className="glass-panel rounded-3xl p-5 border border-[#A998FF]/10">
              <p className="text-xs uppercase tracking-wider text-[#A998FF] font-bold mb-2">Need testnet tokens?</p>
              <p className="text-xs text-[#8991AF] mb-3">Get free USDC and EURC from the Circle Faucet.</p>
              <a href="https://faucet.circle.com" target="_blank" className="flex items-center gap-2 text-sm text-[#A998FF] font-semibold hover:underline">
                faucet.circle.com <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </motion.div>
          </div>
        </div>
        </NetworkGuard>
      </main>
    </PageLayout>
  );
}
