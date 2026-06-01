"use client";

import React from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../../components/Header";
import WaterfallBackground from "../../components/WaterfallBackground";
import Footer from "../../components/Footer";
import { ChevronRight, ExternalLink } from "lucide-react";

// ─── Sections ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "what",        label: "What is Vitael?" },
  { id: "lend",        label: "Lending" },
  { id: "borrow",      label: "Borrowing" },
  { id: "interest",    label: "Interest Rates" },
  { id: "health",      label: "Health Factor" },
  { id: "liquidation", label: "Liquidation" },
  { id: "swap",        label: "Swap" },
  { id: "pool",        label: "Liquidity Pools" },
  { id: "bridge",      label: "Bridge" },
  { id: "faq",         label: "FAQ" },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-extrabold text-white mb-5" style={{ fontFamily: "var(--font-raleway)" }}>
      {children}
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-[#00F5FF] mb-2 mt-7">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[#8E9FB8] text-sm leading-relaxed mb-3">{children}</p>;
}
function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="text-white font-semibold">{children}</span>;
}
function InfoBox({ title, children, color = "#00F5FF" }: { title: string; children: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-2xl border p-5 mb-5" style={{ borderColor: `${color}25`, background: `${color}08` }}>
      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color }}>{title}</p>
      <div className="text-sm text-[#8E9FB8] leading-relaxed space-y-1">{children}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-3 px-5 border-b border-white/5 last:border-0 text-sm">
      <span className="text-[#8E9FB8] flex-1 pr-4">{label}</span>
      <span className="text-white font-semibold text-right flex-1">{value}</span>
    </div>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────
const CONTENT: Record<SectionId, React.ReactNode> = {

  what: (
    <div>
      <H2>What is Vitael?</H2>
      <P>
        Vitael is a <Highlight>DeFi protocol on Arc Testnet</Highlight> that lets you do three things:
        lend your crypto to earn yield, borrow against your assets, and swap tokens — all in one place.
      </P>
      <P>
        Think of it like a decentralized bank. Instead of a bank holding your money and deciding the interest rate,
        Vitael uses smart contracts that run automatically on the blockchain. The rules are transparent,
        the rates adjust based on supply and demand, and you stay in control of your assets at all times.
      </P>

      <H3>What can you do on Vitael?</H3>
      <InfoBox title="Lend" color="#00F5FF">
        <p>Deposit USDC, EURC, or cirBTC into the lending pool. Your balance earns interest automatically — no claiming needed. The longer you leave it, the more you earn.</p>
      </InfoBox>
      <InfoBox title="Borrow" color="#FF00C8">
        <p>Use your deposited assets as collateral to borrow USDC. You keep your original assets and get extra liquidity. You pay interest on what you borrow.</p>
      </InfoBox>
      <InfoBox title="Swap" color="#8B00FF">
        <p>Trade USDC ↔ EURC or USDC ↔ cirBTC instantly. Prices are determined by the liquidity pool, not an order book.</p>
      </InfoBox>
      <InfoBox title="Provide Liquidity" color="#00F5FF">
        <p>Add tokens to a trading pool and earn 0.3% of every swap that goes through it. The more volume, the more you earn.</p>
      </InfoBox>
      <InfoBox title="Bridge" color="#8B00FF">
        <p>Move USDC between Arc Testnet and other chains (Ethereum, Avalanche, etc.) using Circle&apos;s official bridge. No wrapped tokens — always native USDC.</p>
      </InfoBox>

      <H3>Supported assets</H3>
      <div className="flex flex-wrap gap-3 mb-2">
        {[
          { sym: "USDC",   color: "#00F5FF" },
          { sym: "EURC",   color: "#8B00FF" },
          { sym: "cirBTC", color: "#FF9900" },
        ].map(a => (
          <div key={a.sym} className="flex items-center gap-2 glass-panel rounded-xl px-4 py-2.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.color }} />
            <span className="font-bold text-white text-sm">{a.sym}</span>
          </div>
        ))}
      </div>
    </div>
  ),

  lend: (
    <div>
      <H2>Lending</H2>
      <P>
        When you lend on Vitael, you deposit tokens into a shared pool. Borrowers draw from this pool and pay interest.
        That interest flows back to you — the lender — automatically.
      </P>

      <H3>How does earning work?</H3>
      <P>
        Your deposit is tracked as <Highlight>shares</Highlight> in the pool. Over time, each share becomes worth slightly more
        of the underlying token as interest accumulates. You don&apos;t need to do anything — just leave your tokens in the pool.
      </P>
      <P>
        When you withdraw, you get back your original deposit <Highlight>plus all the interest earned</Highlight> since you deposited.
      </P>

      <InfoBox title="Example" color="#00F5FF">
        <p>You deposit 1,000 USDC. The pool earns 5% APY from borrowers. After one year, you can withdraw ~1,050 USDC.</p>
        <p className="mt-1">The exchange rate between your shares and USDC increases gradually every second — not just once a day.</p>
      </InfoBox>

      <H3>What determines the APY?</H3>
      <P>
        The supply APY depends on how much of the pool is being borrowed (utilization rate).
        If 80% of the pool is borrowed out, lenders earn more. If only 10% is borrowed, lenders earn less.
        This is automatic — no one sets the rate manually.
      </P>

      <H3>Can I withdraw anytime?</H3>
      <P>
        Yes, as long as there is enough liquidity in the pool. If 100% of the pool is borrowed out,
        you would need to wait for borrowers to repay before withdrawing. In practice this is rare —
        high utilization drives up borrow rates, which incentivizes repayment.
      </P>

      <H3>Is there a minimum deposit?</H3>
      <P>No minimum. You can deposit any amount.</P>
    </div>
  ),

  borrow: (
    <div>
      <H2>Borrowing</H2>
      <P>
        Borrowing on Vitael is <Highlight>over-collateralized</Highlight> — you must deposit more value than you borrow.
        This protects lenders from losing money if borrowers don&apos;t repay.
      </P>

      <H3>How does it work?</H3>
      <P>
        1. Deposit collateral (USDC, EURC, or cirBTC) into the pool.<br />
        2. Borrow USDC up to your maximum borrowing power.<br />
        3. Use the borrowed USDC however you like.<br />
        4. Repay the loan (plus interest) whenever you want to get your collateral back.
      </P>

      <H3>How much can I borrow?</H3>
      <P>
        Each asset has a <Highlight>Loan-to-Value (LTV)</Highlight> ratio — the maximum percentage of your collateral value you can borrow.
      </P>
      <div className="glass-panel rounded-2xl overflow-hidden mb-4">
        <Row label="USDC collateral"   value="Borrow up to 90% of value" />
        <Row label="EURC collateral"   value="Borrow up to 85% of value" />
        <Row label="cirBTC collateral" value="Borrow up to 70% of value" />
      </div>
      <InfoBox title="Example" color="#FF00C8">
        <p>You deposit 1,000 EURC (~$1,080). With 85% LTV, you can borrow up to $918 worth of USDC.</p>
        <p className="mt-1">It&apos;s wise to borrow less than the maximum to give yourself a safety buffer.</p>
      </InfoBox>

      <H3>Do I pay interest?</H3>
      <P>
        Yes. Interest accrues on your borrowed balance every second. The rate depends on how much of the pool is being used.
        You can repay at any time — there is no fixed term or penalty for early repayment.
      </P>

      <H3>What happens to my collateral?</H3>
      <P>
        Your collateral stays in the smart contract while you have an active loan. You can withdraw it once you repay your debt
        (as long as your health factor stays above 1.0 after the withdrawal).
      </P>
    </div>
  ),

  interest: (
    <div>
      <H2>Interest Rates</H2>
      <P>
        Vitael uses a <Highlight>dynamic interest rate model</Highlight> — rates go up when the pool is heavily used
        and come down when there is plenty of liquidity. This happens automatically, with no human intervention.
      </P>

      <H3>The utilization rate</H3>
      <P>
        Utilization = how much of the pool is currently borrowed. If 1,000 USDC is in the pool and 800 is borrowed out,
        utilization is 80%.
      </P>

      <H3>How rates change</H3>
      <P>
        There is a <Highlight>kink at 80% utilization</Highlight>. Below 80%, rates rise slowly.
        Above 80%, rates rise steeply — this is intentional, to push borrowers to repay and attract new lenders.
      </P>
      <div className="glass-panel rounded-2xl overflow-hidden mb-4">
        <Row label="0% utilization"   value="Borrow ~2% APY · Supply ~0% APY" />
        <Row label="50% utilization"  value="Borrow ~4.5% APY · Supply ~2% APY" />
        <Row label="80% utilization"  value="Borrow ~6% APY · Supply ~4.3% APY" />
        <Row label="100% utilization" value="Borrow ~81% APY · Supply ~73% APY" />
      </div>
      <InfoBox title="Why does supply APY differ from borrow APY?" color="#00F5FF">
        <p>10% of all interest paid by borrowers goes to a protocol reserve fund. The remaining 90% is distributed to lenders. So if borrowers pay 6%, lenders receive ~4.3% (at 80% utilization).</p>
      </InfoBox>

      <H3>Rates update in real time</H3>
      <P>
        Every time someone supplies, borrows, or repays, the interest rate recalculates instantly.
        There are no daily or weekly snapshots — interest compounds continuously.
      </P>
    </div>
  ),

  health: (
    <div>
      <H2>Health Factor</H2>
      <P>
        The health factor is a number that tells you how safe your borrowing position is.
        <Highlight> Above 1.0 = safe. Below 1.0 = at risk of liquidation.</Highlight>
      </P>

      <H3>How is it calculated?</H3>
      <P>
        Health Factor = (value of your collateral × liquidation threshold) ÷ (value of your debt)
      </P>
      <InfoBox title="Example" color="#00F5FF">
        <p>You have 1,000 EURC collateral ($1,080) with an 88% liquidation threshold.</p>
        <p className="mt-1">Threshold value = $1,080 × 88% = $950.40</p>
        <p className="mt-1">You borrowed $500 USDC.</p>
        <p className="mt-1">Health Factor = $950.40 ÷ $500 = <strong className="text-white">1.90 — safe ✓</strong></p>
      </InfoBox>

      <H3>What makes the health factor go down?</H3>
      <P>Two things can lower your health factor:</P>
      <P>
        <Highlight>1. Your collateral loses value</Highlight> — e.g. cirBTC price drops. The collateral is worth less,
        so the numerator shrinks.
      </P>
      <P>
        <Highlight>2. Your debt grows</Highlight> — interest accrues on your loan every second, slowly increasing what you owe.
      </P>

      <H3>What should I aim for?</H3>
      <div className="glass-panel rounded-2xl overflow-hidden mb-4">
        <Row label="Above 2.0"    value="Very safe — comfortable buffer" />
        <Row label="1.5 – 2.0"   value="Safe — monitor occasionally" />
        <Row label="1.1 – 1.5"   value="Caution — add collateral or repay" />
        <Row label="Below 1.1"   value="Danger — liquidation risk" />
        <Row label="Below 1.0"   value="Liquidatable" />
      </div>
      <P>
        If your health factor is getting close to 1.0, you can either <Highlight>add more collateral</Highlight> or
        <Highlight> repay part of your debt</Highlight> to bring it back up.
      </P>
    </div>
  ),

  liquidation: (
    <div>
      <H2>Liquidation</H2>
      <P>
        Liquidation is the mechanism that keeps the protocol solvent. When a borrower&apos;s health factor drops below 1.0,
        their position can be partially repaid by anyone — called a <Highlight>liquidator</Highlight>.
      </P>

      <H3>Why does liquidation exist?</H3>
      <P>
        Without liquidation, a borrower could let their debt grow larger than their collateral, leaving lenders with losses.
        Liquidation ensures this never happens by closing risky positions before they go underwater.
      </P>

      <H3>What happens during liquidation?</H3>
      <P>
        A liquidator repays up to 50% of the borrower&apos;s debt. In return, they receive the equivalent value of collateral
        <Highlight> plus a bonus</Highlight> (5–10% depending on the asset). This bonus is the liquidator&apos;s profit.
      </P>
      <InfoBox title="Example" color="#FF00C8">
        <p>Bob borrowed $900 USDC against 1,000 EURC. EURC price drops — his health factor falls below 1.0.</p>
        <p className="mt-1">A liquidator repays $200 of Bob&apos;s debt.</p>
        <p className="mt-1">The liquidator receives $200 × 1.05 = $210 worth of EURC from Bob&apos;s collateral.</p>
        <p className="mt-1">Bob&apos;s debt is now $700. His health factor improves.</p>
      </InfoBox>

      <H3>Liquidation bonuses</H3>
      <div className="glass-panel rounded-2xl overflow-hidden mb-4">
        <Row label="USDC collateral"   value="+5% bonus" />
        <Row label="EURC collateral"   value="+5% bonus" />
        <Row label="cirBTC collateral" value="+10% bonus" />
      </div>

      <H3>How to avoid liquidation</H3>
      <P>• Keep your health factor well above 1.0 (aim for 1.5+)</P>
      <P>• Don&apos;t borrow close to your maximum LTV</P>
      <P>• Monitor volatile collateral like cirBTC more closely</P>
      <P>• Repay debt or add collateral if the health factor drops</P>
    </div>
  ),

  swap: (
    <div>
      <H2>Swap</H2>
      <P>
        The Vitael swap lets you exchange one token for another instantly. There is no order book —
        trades happen against a <Highlight>liquidity pool</Highlight> using an automated pricing formula.
      </P>

      <H3>How is the price determined?</H3>
      <P>
        The price comes from the ratio of tokens in the pool. If the pool has 10,000 USDC and 9,259 EURC,
        1 EURC costs roughly 1.08 USDC. When you buy EURC, the pool has less EURC and more USDC,
        so the price of EURC goes up slightly. This is called <Highlight>price impact</Highlight>.
      </P>

      <H3>What is slippage?</H3>
      <P>
        Slippage is the difference between the price you expect and the price you actually get.
        Large trades relative to pool size cause more slippage. You can set a slippage tolerance
        (0.1%, 0.5%, 1%) — if the price moves more than that, the transaction reverts.
      </P>

      <H3>Trading fee</H3>
      <P>
        Every swap charges a <Highlight>0.3% fee</Highlight>. This fee stays in the pool and is distributed
        to liquidity providers proportionally.
      </P>

      <H3>Available pairs</H3>
      <div className="glass-panel rounded-2xl overflow-hidden mb-4">
        <Row label="USDC / EURC"   value="Stablecoin pair" />
        <Row label="USDC / cirBTC" value="BTC pair" />
      </div>
    </div>
  ),

  pool: (
    <div>
      <H2>Liquidity Pools</H2>
      <P>
        Liquidity providers (LPs) deposit pairs of tokens into a pool. Traders swap against this pool,
        and LPs earn a share of the 0.3% fee on every trade.
      </P>

      <H3>How does providing liquidity work?</H3>
      <P>
        You deposit equal value of two tokens (e.g. $500 USDC + $500 EURC). You receive
        <Highlight> LP tokens</Highlight> representing your share of the pool.
        As trades happen, fees accumulate in the pool. When you withdraw, you get back your tokens plus fees earned.
      </P>

      <H3>What is impermanent loss?</H3>
      <P>
        If the price ratio between the two tokens changes significantly while you are providing liquidity,
        you may end up with less value than if you had just held the tokens. This is called impermanent loss.
        It is &quot;impermanent&quot; because if the price returns to the original ratio, the loss disappears.
      </P>
      <InfoBox title="Low risk pairs" color="#00F5FF">
        <p>USDC/EURC is a stablecoin pair — both tokens are pegged to fiat currencies, so the price ratio is very stable. Impermanent loss is minimal.</p>
      </InfoBox>
      <InfoBox title="Higher risk pairs" color="#FF00C8">
        <p>USDC/cirBTC has more impermanent loss risk because BTC price is volatile. Fee income may or may not offset the loss depending on trading volume.</p>
      </InfoBox>

      <H3>How to add liquidity</H3>
      <P>1. Go to the Pool page and select a pair.</P>
      <P>2. Enter the amount of one token — the other fills automatically based on the current ratio.</P>
      <P>3. Approve both tokens and confirm the transaction.</P>
      <P>4. You receive LP tokens. Hold them to keep earning fees.</P>

      <H3>How to remove liquidity</H3>
      <P>Go to Pool → Remove Liquidity, select your percentage (25%, 50%, 75%, 100%), and confirm. You receive both tokens back plus accumulated fees.</P>
    </div>
  ),

  bridge: (
    <div>
      <H2>Bridge</H2>
      <P>
        The Vitael bridge lets you move <Highlight>native USDC</Highlight> between Arc Testnet and other blockchains.
        It uses Circle&apos;s official Cross-Chain Transfer Protocol (CCTP) — the same technology used by major DeFi protocols.
      </P>

      <H3>Why is this different from a regular bridge?</H3>
      <P>
        Most bridges wrap tokens — you send USDC on Ethereum and receive a &quot;wrapped USDC&quot; on the destination chain.
        CCTP is different: it <Highlight>burns</Highlight> USDC on the source chain and <Highlight>mints</Highlight> native USDC
        on the destination. You always receive real USDC, not a wrapped version.
      </P>

      <H3>How long does it take?</H3>
      <P>
        On testnet, the bridge typically takes <Highlight>20–60 seconds</Highlight>. The UI shows you the status in real time:
        Approving → Burning → Waiting for attestation → Minting.
      </P>

      <H3>Supported chains (testnet)</H3>
      <div className="glass-panel rounded-2xl overflow-hidden mb-4">
        <Row label="Arc Testnet"       value="Chain ID 5042002" />
        <Row label="Ethereum Sepolia"  value="Testnet" />
        <Row label="Avalanche Fuji"    value="Testnet" />
        <Row label="OP Sepolia"        value="Testnet" />
        <Row label="Arbitrum Sepolia"  value="Testnet" />
        <Row label="Base Sepolia"      value="Testnet" />
      </div>

      <H3>Is there a fee?</H3>
      <P>
        CCTP itself has no protocol fee. You only pay gas on both the source and destination chains.
        On Arc Testnet, gas is paid in USDC (Arc&apos;s native gas token).
      </P>
    </div>
  ),

  faq: (
    <div>
      <H2>FAQ</H2>

      <H3>Is Vitael safe to use?</H3>
      <P>
        Vitael is a <Highlight>testnet protocol</Highlight> — it has not been audited and is for demonstration purposes only.
        Do not use real funds. The contracts are open source and the logic is transparent on-chain.
      </P>

      <H3>Where do I get testnet tokens?</H3>
      <P>
        From the <a href="https://faucet.circle.com" target="_blank" className="text-[#00F5FF] hover:underline inline-flex items-center gap-1">Circle Faucet <ExternalLink className="w-3 h-3" /></a>.
        You can claim USDC and EURC for free on Arc Testnet. cirBTC is available from the same faucet.
      </P>

      <H3>Why is the supply APY 0%?</H3>
      <P>
        Supply APY is 0% when nobody is borrowing from the pool. As soon as borrowers take loans,
        interest starts flowing to lenders. Try borrowing some USDC after supplying to see the rate change.
      </P>

      <H3>What wallet do I need?</H3>
      <P>
        Any EVM-compatible wallet works — MetaMask, Coinbase Wallet, Rainbow, etc.
        Add Arc Testnet manually: RPC <Highlight>https://rpc.testnet.arc.network</Highlight>, Chain ID <Highlight>5042002</Highlight>.
      </P>

      <H3>What is the difference between supplying and depositing collateral?</H3>
      <P>
        <Highlight>Supplying</Highlight> puts your tokens in the pool to earn yield. Your supplied balance also counts as collateral.
      </P>
      <P>
        <Highlight>Depositing collateral</Highlight> (on the Borrow page) is a separate action that does not earn yield —
        it just backs your loan. Use this if you want to borrow without exposing your assets to supply-side dynamics.
      </P>

      <H3>Can I lose my collateral?</H3>
      <P>
        Yes — if your health factor drops below 1.0 and you don&apos;t act, a liquidator can seize part of your collateral.
        Always keep a comfortable health factor buffer (1.5+) and monitor volatile assets like cirBTC.
      </P>

      <H3>How do I see my position?</H3>
      <P>
        Connect your wallet on the Lend or Borrow page. Your supplied balances, borrowed amounts, health factor,
        and collateral are all shown in real time.
      </P>
    </div>
  ),
};

// ─── Mobile section picker ────────────────────────────────────────────────────
function MobileSectionPicker({
  active, setActive,
}: {
  active: SectionId;
  setActive: (id: SectionId) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = SECTIONS.find(s => s.id === active)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between glass-panel border-white/10 hover:border-[#00F5FF]/40 text-white rounded-2xl px-5 py-4 text-sm font-semibold transition shadow-lg"
      >
        <span className="flex items-center gap-2.5">
          <ChevronRight className="w-4 h-4 text-[#00F5FF]" />
          {current.label}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-4 h-4 text-[#8E9FB8] rotate-90" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full mt-2 left-0 right-0 z-50 glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10"
          >
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => { setActive(s.id); setOpen(false); }}
                className={`w-full text-left px-5 py-3.5 text-sm transition flex items-center gap-2.5 ${
                  s.id === active
                    ? "bg-[#00F5FF]/10 text-[#00F5FF] font-semibold"
                    : "text-[#8E9FB8] hover:bg-white/5 hover:text-white"
                }`}
              >
                {s.id === active && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                {s.id !== active && <span className="w-3.5" />}
                {s.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function DocsPage() {
  const [active, setActive] = useState<SectionId>("what");
  const activeIdx = SECTIONS.findIndex(s => s.id === active);

  return (
    <div className="relative min-h-screen text-white font-sans">
      <WaterfallBackground />
      <Header />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <span className="text-xs uppercase tracking-widest text-[#00F5FF] font-bold mb-2 block">
            Vitael Protocol
          </span>
          <h1 className="text-4xl font-extrabold text-white" style={{ fontFamily: "var(--font-raleway)" }}>
            How Vitael Works
          </h1>
          <p className="text-[#8E9FB8] mt-2 text-sm max-w-xl">
            Everything you need to know about lending, borrowing, swapping, and earning on Arc Testnet.
          </p>
        </motion.div>

        <div className="flex gap-8 items-start">
          {/* ── Sidebar ── */}
          <aside className="hidden lg:block w-52 flex-shrink-0 sticky top-24">
            <nav className="space-y-1">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2.5 ${
                    active === s.id
                      ? "bg-[#00F5FF]/10 text-[#00F5FF] font-semibold border border-[#00F5FF]/20"
                      : "text-[#8E9FB8] hover:text-white hover:bg-white/5"
                  }`}
                >
                  {active === s.id
                    ? <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] flex-shrink-0" />
                    : <span className="w-1.5" />
                  }
                  {s.label}
                </button>
              ))}
            </nav>

            <div className="mt-8 pt-6 border-t border-white/5 space-y-2.5">
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#8E9FB8] hover:text-[#00F5FF] transition"
              >
                <ExternalLink className="w-3 h-3" /> Circle Faucet
              </a>
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#8E9FB8] hover:text-[#00F5FF] transition"
              >
                <ExternalLink className="w-3 h-3" /> ArcScan Explorer
              </a>
            </div>
          </aside>

          {/* ── Content ── */}
          <main className="flex-1 min-w-0">
            {/* Mobile picker — custom dropdown */}
            <div className="lg:hidden mb-6 relative">
              <MobileSectionPicker active={active} setActive={setActive} />
            </div>

            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="glass-panel rounded-3xl p-8 min-h-[560px]"
            >
              {CONTENT[active]}
            </motion.div>

            {/* Prev / Next */}
            <div className="flex justify-between mt-4">
              {activeIdx > 0 ? (
                <button
                  onClick={() => setActive(SECTIONS[activeIdx - 1].id)}
                  className="text-xs text-[#8E9FB8] hover:text-white transition flex items-center gap-1"
                >
                  ← {SECTIONS[activeIdx - 1].label}
                </button>
              ) : <span />}

              {activeIdx < SECTIONS.length - 1 ? (
                <button
                  onClick={() => setActive(SECTIONS[activeIdx + 1].id)}
                  className="text-xs text-[#8E9FB8] hover:text-white transition flex items-center gap-1 ml-auto"
                >
                  {SECTIONS[activeIdx + 1].label} →
                </button>
              ) : <span />}
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
