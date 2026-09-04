"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useAccount } from "wagmi";
import PageLayout from "../../components/PageLayout";
import NetworkGuard from "../../components/NetworkGuard";
import TokenIcon from "../../components/TokenIcon";
import TxStatusBanner from "../../components/TxStatusBanner";
import WalletActionGate, { WalletConnectPrompt } from "../../components/WalletActionGate";
import { useVault, type VaultSnapshot } from "../../hooks/useVault";

const STEP_LABELS: Record<string, string> = {
  switching: "Switching to Arc Testnet...",
  approving: "Approving USDC — sign in your wallet...",
  depositing: "Depositing into the vault — sign in your wallet...",
  withdrawing: "Withdrawing USDC — sign in your wallet...",
  confirming: "Waiting for on-chain confirmation...",
};

function number(value?: string) {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function display(value?: string, suffix = " USDC") {
  return `${number(value).toFixed(1)}${suffix}`;
}

export default function VaultsPage() {
  const { address, isConnected } = useAccount();
  const { state, reset, getSnapshot, deposit, withdraw, configured } = useVault();
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null);
  const [loading, setLoading] = useState(configured);
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");

  async function refresh() {
    if (!configured) return;
    try { setSnapshot(await getSnapshot(address)); } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [address, configured, getSnapshot]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state.step === "done") {
      void refresh();
    }
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const tvl = number(snapshot?.totalAssets);
  const cap = number(snapshot?.depositCap);
  const capUsed = cap > 0 ? Math.min(100, (tvl / cap) * 100) : 0;
  const walletBalance = number(snapshot?.walletBalance);
  const maxWithdraw = number(snapshot?.maxWithdraw);
  const entered = number(amount);
  const max = tab === "deposit" ? Math.max(0, Math.min(walletBalance, cap - tvl)) : maxWithdraw;
  const invalid = (tab === "deposit" ? entered < 1 : entered <= 0) || entered > max || snapshot?.shutdown;
  const projectedYearly = entered * ((snapshot?.apyPct ?? 0) / 100);
  const sharePrice = number(snapshot?.totalSupply) > 0 ? tvl / number(snapshot?.totalSupply) : 1;

  async function execute() {
    if (invalid) return;
    reset();
    if (tab === "deposit") await deposit(amount);
    else await withdraw(amount);
  }

  return (
    <PageLayout variant="app">
      <main className="app-page relative z-10 mx-auto max-w-7xl space-y-8 px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <span className="app-eyebrow mb-2 block text-xs font-bold uppercase tracking-widest">Arc Testnet · Automated yield</span>
          <h1 className="app-page-title text-5xl text-white">Vaults</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8991AF]">
            Deposit USDC once. The vault supplies it to Vitael Lending, and lending interest automatically increases the value of your vault shares.
          </p>
        </motion.div>

        {!configured && (
          <div className="app-notice app-notice-warning border px-5 py-4 text-sm">
            The USDC vault is ready in the app but has not been deployed yet. Deploy it, then set <code>NEXT_PUBLIC_USDC_VAULT</code>.
          </div>
        )}

        <NetworkGuard>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-panel overflow-hidden rounded-3xl lg:col-span-2">
              <div className="border-b border-white/5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <TokenIcon symbol="USDC" size={48} />
                      <Sparkles className="absolute -right-2 -top-2 h-4 w-4 text-[#A998FF]" />
                    </div>
                    <div><h2 className="text-xl font-bold text-white">USDC Earn Vault</h2><p className="mt-1 text-xs text-[#8991AF]">ERC-4626 · Vitael Lending Strategy</p></div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${snapshot?.shutdown ? "border-red-400/20 bg-red-400/10 text-red-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}`}>
                    {snapshot?.shutdown ? "Emergency mode" : "Active"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px bg-white/5 md:grid-cols-4">
                {[
                  ["Supply APY", `${(snapshot?.apyPct ?? 0).toFixed(1)}%`],
                  ["Total assets", display(snapshot?.totalAssets)],
                  ["Available to withdraw", display(snapshot?.availableLiquidity)],
                  ["Share price", `${sharePrice.toFixed(1)} USDC`],
                ].map(([label, value]) => <div key={label} className="bg-[#0d0e1e] p-5"><p className="text-xs text-[#8991AF]">{label}</p><p className="mt-2 text-lg font-bold text-white">{loading ? "—" : value}</p></div>)}
              </div>

              <div className="space-y-5 p-6">
                <div>
                  <div className="mb-2 flex justify-between text-xs"><span className="text-[#8991AF]">Testnet deposit cap</span><span className="text-white">{display(snapshot?.totalAssets)} / {display(snapshot?.depositCap)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-[#7968e8] to-[#A998FF]" style={{ width: `${capUsed}%` }} /></div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"><p className="text-sm font-semibold">Non-custodial shares</p><p className="mt-2 text-xs leading-5 text-[#8991AF]">Your ERC-4626 shares represent a proportional claim on vault assets.</p></div>
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"><p className="text-sm font-semibold">Native compounding</p><p className="mt-2 text-xs leading-5 text-[#8991AF]">Interest accrues through the lending exchange rate without manual claiming.</p></div>
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"><p className="text-sm font-semibold">Capped launch</p><p className="mt-2 text-xs leading-5 text-[#8991AF]">The initial cap limits exposure while the vault is validated on testnet.</p></div>
                </div>
              </div>
            </motion.section>

            <motion.aside initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass-panel app-action-panel rounded-3xl p-6">
              <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/5 bg-black/30 p-1">
                {(["deposit", "withdraw"] as const).map(item => <button key={item} onClick={() => { setTab(item); setAmount(""); reset(); }} className={`rounded-lg py-2.5 text-sm font-semibold capitalize ${tab === item ? "bg-[#A998FF]/10 text-[#c9beff]" : "text-[#8991AF]"}`}>{item}</button>)}
              </div>

              <TxStatusBanner step={state.step} error={state.error} txHash={state.txHash} stepLabels={STEP_LABELS} />

              <WalletActionGate connectMessage={`Connect your wallet to ${tab} USDC`}>
                {!isConnected ? <WalletConnectPrompt message={`Connect your wallet to ${tab} USDC`} /> : (
                  <div className="space-y-5">
                    <div>
                      <div className="mb-2 flex justify-between text-xs text-[#8991AF]"><span>Amount</span><span>{tab === "deposit" ? "Wallet" : "Withdrawable"}: {max.toFixed(1)} USDC</span></div>
                      <div className="flex items-center rounded-2xl border border-white/10 bg-black/30 px-4 py-4 focus-within:border-[#A998FF]/40">
                        <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-white outline-none" />
                        <button onClick={() => setAmount(max.toString())} className="mr-3 text-xs font-bold text-[#A998FF]">MAX</button>
                        <div className="flex items-center gap-2"><TokenIcon symbol="USDC" size={24} /><span className="font-bold">USDC</span></div>
                      </div>
                      {entered > max && <p className="mt-2 text-xs text-red-300">Amount exceeds the available limit.</p>}
                      {tab === "deposit" && entered > 0 && entered < 1 && <p className="mt-2 text-xs text-amber-300">Minimum deposit is 1 USDC.</p>}
                    </div>

                    <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-xs">
                      <div className="flex justify-between text-[#8991AF]"><span>{tab === "deposit" ? "Estimated yearly yield" : "Shares remain invested"}</span><span className="text-emerald-300">{tab === "deposit" ? `≈ ${projectedYearly.toFixed(1)} USDC` : display(snapshot?.positionAssets)}</span></div>
                      <div className="flex justify-between text-[#8991AF]"><span>Strategy</span><span className="text-white">Vitael USDC Lending</span></div>
                      <div className="flex justify-between text-[#8991AF]"><span>Performance fee</span><span className="text-white">0%</span></div>
                    </div>

                    <button disabled={!configured || invalid || state.busy} onClick={() => void execute()} className="app-button app-button-primary flex w-full items-center justify-center gap-2 py-3.5 disabled:cursor-not-allowed disabled:opacity-40">
                      {snapshot?.shutdown ? "Vault in emergency mode" : `${tab === "deposit" ? "Deposit" : "Withdraw"} USDC`}
                    </button>
                  </div>
                )}
              </WalletActionGate>
            </motion.aside>
          </div>

          <div className="mt-6 rounded-2xl border border-[#A998FF]/10 bg-[#A998FF]/5 p-5">
            <div><p className="text-sm font-semibold text-white">Agent-ready vault</p><p className="mt-1 text-xs leading-5 text-[#8991AF]">Vitael Agent can inspect this vault, quote deposits, and prepare unsigned deposit or withdrawal transactions. Your wallet always provides final approval.</p></div>
          </div>
        </NetworkGuard>
      </main>
    </PageLayout>
  );
}
