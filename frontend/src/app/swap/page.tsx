"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown, Settings, ChevronDown, Wallet, RefreshCw, ExternalLink } from "lucide-react";
import TxStatusBanner from "../../components/TxStatusBanner";
import { useAccount, useReadContract } from "wagmi";
import WalletConnectButton from "../../components/WalletConnectButton";
import PageLayout from "../../components/PageLayout";
import TokenIcon from "../../components/TokenIcon";
import NetworkGuard from "../../components/NetworkGuard";
import { useVitaelDEX, type TokenSymbol, TOKENS } from "../../hooks/useVitaelDEX";
import { formatUnits } from "viem";
import { formatTokenAmount } from "../../lib/format";

const TOKEN_LIST = Object.values(TOKENS);

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

const DEX_STEP_LABELS: Record<string, string> = {
  switching: "Switching to Arc Testnet...",
  approving: "Approving — sign in wallet...",
  swapping: "Swapping — sign in wallet...",
  confirming: "Waiting for confirmation...",
};

export default function SwapPage() {
  const { isConnected, address } = useAccount();
  const { state, swap, getQuote, reset } = useVitaelDEX();

  const [tokenIn,  setTokenIn]  = useState<TokenSymbol>("USDC");
  const [tokenOut, setTokenOut] = useState<TokenSymbol>("EURC");
  const [amountIn, setAmountIn] = useState("");
  const [quote,    setQuote]    = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [showSlip, setShowSlip] = useState(false);
  const [quoting,  setQuoting]  = useState(false);

  const busy = state.busy;

  // Fetch balance for tokenIn
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: TOKENS[tokenIn].address as `0x${string}`,
    abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] }],
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const balance = balanceData
    ? formatUnits(balanceData as bigint, TOKENS[tokenIn].decimals)
    : "0";

  // Balance validation
  const numAmt = parseFloat(amountIn) || 0;
  const balAmt = parseFloat(balance);
  const insufficientBalance = numAmt > balAmt;

  // Refetch balance when token changes or tx completes
  useEffect(() => {
    if (address) refetchBalance();
  }, [tokenIn, address, state.step, refetchBalance]);

  const fetchQuote = useCallback(async (s1: TokenSymbol, s2: TokenSymbol, amt: string) => {
    if (!amt || parseFloat(amt) <= 0) { setQuote(""); return; }
    setQuoting(true);
    const q = await getQuote(s1, s2, amt);
    setQuote(q);
    setQuoting(false);
  }, [getQuote]);

  useEffect(() => {
    const t = setTimeout(() => fetchQuote(tokenIn, tokenOut, amountIn), 400);
    return () => clearTimeout(t);
  }, [amountIn, tokenIn, tokenOut, fetchQuote]);

  function flip() { setTokenIn(tokenOut); setTokenOut(tokenIn); setAmountIn(""); setQuote(""); reset(); }

  return (
    <PageLayout variant="app">
      <main className="app-page relative z-10 max-w-5xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <span className="app-eyebrow text-xs uppercase tracking-widest text-[#A998FF] font-bold mb-2 block">Arc Testnet · Vitael DEX V2</span>
          <h1 className="app-page-title text-5xl text-white">Swap</h1>
          <p className="text-[#8991AF] mt-2 text-sm">Swap tokens on Arc Testnet. You sign all transactions in your wallet.</p>
        </motion.div>

        <NetworkGuard>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="app-action-panel lg:col-span-3 glass-panel rounded-3xl p-6 relative">
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#A998FF]/4 rounded-full blur-3xl pointer-events-none overflow-hidden" />

            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-white text-lg">Swap Tokens</h2>
              <button onClick={() => setShowSlip(!showSlip)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${showSlip ? "bg-[#A998FF]/10 border-[#A998FF]/30 text-[#A998FF]" : "border-white/10 text-[#8991AF] hover:text-white"}`}>
                <Settings className="w-3.5 h-3.5" /> {slippage}% slippage
              </button>
            </div>

            <AnimatePresence>
              {showSlip && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
                  <div className="bg-white/3 rounded-xl p-3 flex gap-2">
                    {[0.1, 0.5, 1.0].map(v => (
                      <button key={v} onClick={() => setSlippage(v)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${slippage === v ? "bg-[#A998FF] text-[#0D0E1E]" : "bg-white/5 text-[#8991AF] hover:bg-white/10"}`}>
                        {v}%
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-black/30 border border-white/5 focus-within:border-[#A998FF]/30 rounded-2xl p-4 mb-1 transition">
              <p className="text-xs text-[#8991AF] uppercase tracking-wider mb-3">From</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  placeholder="0.00"
                  value={amountIn}
                  disabled={busy}
                  onChange={e => {
                    const val = e.target.value;
                    if (val && parseFloat(val) < 0) return;
                    setAmountIn(val);
                    reset();
                  }}
                  onBlur={() => {
                    if (!amountIn) return;
                    const val = parseFloat(amountIn);
                    const maxBal = parseFloat(balance);
                    if (val > maxBal) setAmountIn(maxBal.toString());
                  }}
                  className="flex-1 bg-transparent text-2xl font-bold text-white outline-none placeholder-white/20 disabled:opacity-50"
                />
                <TokenSelector selected={tokenIn} onSelect={s => { setTokenIn(s); reset(); }} exclude={tokenOut} />
              </div>
              <div className="flex justify-between mt-2 text-xs text-[#8991AF]">
                <span>Balance: {formatTokenAmount(balance, { min: 2, max: 3 })} {tokenIn}</span>
                <button
                  className="text-[#A998FF] hover:underline"
                  onClick={() => setAmountIn(balance)}
                  disabled={!isConnected}
                >
                  MAX
                </button>
              </div>
              {insufficientBalance && amountIn && (
                <p className="text-xs text-red-400 mt-1">
                  Insufficient {tokenIn} balance
                </p>
              )}
            </div>

            <div className="flex justify-center my-1">
              <button onClick={flip} disabled={busy}
                className="w-9 h-9 rounded-full bg-[#0D0E1E] border border-white/10 flex items-center justify-center text-[#A998FF] hover:bg-[#A998FF]/10 transition disabled:opacity-40">
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black/30 border border-white/5 rounded-2xl p-4 mb-5">
              <p className="text-xs text-[#8991AF] uppercase tracking-wider mb-3">To (estimated)</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-2xl font-bold text-white/50 flex items-center gap-2">
                  {quoting ? <RefreshCw className="w-4 h-4 animate-spin text-[#A998FF]" /> : (quote || "—")}
                </div>
                <TokenSelector selected={tokenOut} onSelect={s => { setTokenOut(s); reset(); }} exclude={tokenIn} />
              </div>
            </div>

            {quote && amountIn && (
              <div className="bg-white/2 rounded-xl p-3 mb-4 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-[#8991AF]">Rate</span>
                  <span className="text-white">1 {tokenIn} ≈ {(parseFloat(quote)/parseFloat(amountIn)).toFixed(6)} {tokenOut}</span></div>
                <div className="flex justify-between"><span className="text-[#8991AF]">Fee</span><span className="text-white">0.3%</span></div>
                <div className="flex justify-between"><span className="text-[#8991AF]">Slippage</span><span className="text-white">{slippage}%</span></div>
              </div>
            )}

            <TxStatusBanner step={state.step} error={state.error} txHash={state.txHash} stepLabels={DEX_STEP_LABELS} />

            {!isConnected ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <p className="text-sm text-[#8991AF] flex items-center gap-2"><Wallet className="w-4 h-4" />Connect wallet to swap</p>
                <WalletConnectButton />
              </div>
            ) : state.step === "done" ? (
              <button onClick={() => { reset(); setAmountIn(""); setQuote(""); }}
                className="app-button app-button-secondary w-full bg-white/5 border border-white/10 text-white font-semibold py-3.5 rounded-xl hover:bg-white/10 transition">Swap Again</button>
            ) : (
              <button onClick={() => swap(tokenIn, tokenOut, amountIn, slippage)}
                disabled={busy || !amountIn || parseFloat(amountIn) <= 0 || insufficientBalance}
                className="app-button app-button-primary w-full bg-[#A998FF] text-[#0D0E1E] font-bold py-3.5 rounded-xl hover:bg-white transition disabled:opacity-40 flex items-center justify-center gap-2">
                {busy ? <><div className="w-5 h-5 border-2 border-[#0D0E1E]/30 border-t-[#0D0E1E] rounded-full animate-spin" />Processing...</>
                  : `Swap ${tokenIn} → ${tokenOut}`}
              </button>
            )}
          </motion.div>

          <div className="lg:col-span-2 space-y-5">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
              className="glass-panel rounded-3xl p-5">
              <p className="text-xs uppercase tracking-wider text-[#8991AF] mb-4">Supported Tokens</p>
              <div className="space-y-2">
                {TOKEN_LIST.map(t => (
                  <div key={t.symbol} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <TokenIcon symbol={t.symbol} size={28} />
                    <div><p className="text-sm font-bold text-white">{t.symbol}</p><p className="text-xs text-[#8991AF]">{t.name}</p></div>
                    <span className="ml-auto text-xs text-emerald-400 font-semibold">✓</span>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
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
