"use client";

import React from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MarketingHeader from "../../components/MarketingHeader";
import { ArrowLeft, ArrowRight, ChevronRight, ExternalLink } from "lucide-react";

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

const SECTION_GROUPS = [
  { label: "Overview", items: ["what"] },
  { label: "Lending protocol", items: ["lend", "borrow", "interest", "health", "liquidation"] },
  { label: "Move assets", items: ["swap", "pool", "bridge"] },
  { label: "Resources", items: ["faq"] },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="marketing-display mb-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
      {children}
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 mt-9 text-sm font-semibold tracking-[-0.01em] text-[#b7a8ff]">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[15px] leading-7 text-[#979eb8]">{children}</p>;
}
function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="text-white font-semibold">{children}</span>;
}
function InfoBox({ title, children, color = "#A998FF" }: { title: string; children: React.ReactNode; color?: string }) {
  return (
    <div className="docs-callout mb-5 rounded-2xl border p-5" style={{ borderColor: `${color}25`, background: `${color}08` }}>
      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color }}>{title}</p>
      <div className="space-y-1 text-sm leading-6 text-[#9199b4]">{children}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5 text-sm last:border-0">
      <span className="text-[#8991AF] flex-1 pr-4">{label}</span>
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
      <InfoBox title="Lend" color="#A998FF">
        <p>Deposit USDC, EURC, or cirBTC into the lending pool. Your balance earns interest automatically — no claiming needed. The longer you leave it, the more you earn.</p>
      </InfoBox>
      <InfoBox title="Borrow" color="#7EE2B7">
        <p>Use your deposited assets as collateral to borrow USDC. You keep your original assets and get extra liquidity. You pay interest on what you borrow.</p>
      </InfoBox>
      <InfoBox title="Swap" color="#7968E8">
        <p>Trade USDC ↔ EURC or USDC ↔ cirBTC instantly. Prices are determined by the liquidity pool, not an order book.</p>
      </InfoBox>
      <InfoBox title="Provide Liquidity" color="#A998FF">
        <p>Add tokens to a trading pool and earn 0.3% of every swap that goes through it. The more volume, the more you earn.</p>
      </InfoBox>
      <InfoBox title="Bridge" color="#7968E8">
        <p>Move USDC between Arc Testnet and other chains (Ethereum, Avalanche, etc.) using Circle&apos;s official bridge. No wrapped tokens — always native USDC.</p>
      </InfoBox>

      <H3>Supported assets</H3>
      <div className="flex flex-wrap gap-3 mb-2">
        {[
          { sym: "USDC",   color: "#A998FF" },
          { sym: "EURC",   color: "#7968E8" },
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

      <InfoBox title="Example" color="#A998FF">
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
      <InfoBox title="Example" color="#7EE2B7">
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
      <InfoBox title="Why does supply APY differ from borrow APY?" color="#A998FF">
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
      <InfoBox title="Example" color="#A998FF">
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
      <InfoBox title="Example" color="#7EE2B7">
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
      <InfoBox title="Low risk pairs" color="#A998FF">
        <p>USDC/EURC is a stablecoin pair — both tokens are pegged to fiat currencies, so the price ratio is very stable. Impermanent loss is minimal.</p>
      </InfoBox>
      <InfoBox title="Higher risk pairs" color="#7EE2B7">
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
        From the <a href="https://faucet.circle.com" target="_blank" className="text-[#A998FF] hover:underline inline-flex items-center gap-1">Circle Faucet <ExternalLink className="w-3 h-3" /></a>.
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
        className="docs-mobile-picker flex w-full items-center justify-between rounded-xl border border-white/10 px-4 py-3.5 text-sm font-semibold text-white transition"
      >
        <span className="flex items-center gap-2.5">
          <ChevronRight className="w-4 h-4 text-[#A998FF]" />
          {current.label}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-4 h-4 text-[#8991AF] rotate-90" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="docs-mobile-menu absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10"
          >
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => { setActive(s.id); setOpen(false); }}
                className={`w-full text-left px-5 py-3.5 text-sm transition flex items-center gap-2.5 ${
                  s.id === active
                    ? "bg-[#A998FF]/10 text-[#A998FF] font-semibold"
                    : "text-[#8991AF] hover:bg-white/5 hover:text-white"
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
  const currentSection = SECTIONS[activeIdx];

  return (
    <div id="top" className="docs-site marketing-site min-h-screen">
      <MarketingHeader />
      <div className="docs-subnav">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-2 text-xs"><span className="font-semibold text-[#d7d9e5]">Documentation</span><ChevronRight className="size-3 text-[#4f5771]" /><span className="truncate text-[#777f99]">{currentSection.label}</span></div>
          <div className="hidden items-center gap-5 text-[11px] text-[#727a94] sm:flex"><a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" className="hover:text-white">ArcScan</a><a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="hover:text-white">Testnet faucet</a></div>
        </div>
      </div>
      <div className="docs-layout relative z-10 mx-auto grid max-w-[1440px] px-5 sm:px-8 lg:grid-cols-[240px_minmax(0,760px)] xl:grid-cols-[240px_minmax(0,760px)_200px]">
        <aside className="docs-sidebar sticky top-[130px] hidden h-[calc(100dvh-130px)] overflow-y-auto py-10 pr-7 lg:block">
          {SECTION_GROUPS.map(group => (
            <div key={group.label} className="mb-7">
              <p className="docs-group-label">{group.label}</p>
              <nav>
                {group.items.map(id => {
                  const section = SECTIONS.find(item => item.id === id)!;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActive(section.id)}
                      className={`docs-nav-item ${active === section.id ? "docs-nav-active" : ""}`}
                    >
                      {section.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </aside>

        <main className="min-w-0 py-8 lg:px-10 lg:py-10 xl:px-12">
          <div className="relative mb-8 lg:hidden">
            <MobileSectionPicker active={active} setActive={setActive} />
          </div>

          <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#656d87]">
            <span>Vitael protocol</span>
            <span className="size-1 rounded-full bg-[#8f7cff]" />
            <span>{String(activeIdx + 1).padStart(2, "0")}</span>
          </div>

          <motion.article
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="docs-article min-h-[560px]"
          >
            {CONTENT[active]}
          </motion.article>

          <div className="mt-14 grid grid-cols-2 border-t border-white/[0.07]">
            {activeIdx > 0 ? (
              <button onClick={() => setActive(SECTIONS[activeIdx - 1].id)} className="docs-page-link items-start text-left">
                <span><ArrowLeft className="size-3.5" /> Previous</span>
                <strong>{SECTIONS[activeIdx - 1].label}</strong>
              </button>
            ) : <span />}

            {activeIdx < SECTIONS.length - 1 ? (
              <button onClick={() => setActive(SECTIONS[activeIdx + 1].id)} className="docs-page-link items-end border-l border-white/[0.07] text-right">
                <span>Next <ArrowRight className="size-3.5" /></span>
                <strong>{SECTIONS[activeIdx + 1].label}</strong>
              </button>
            ) : <span />}
          </div>

          <p className="mt-8 text-[11px] leading-5 text-[#59617a]">Vitael documentation · Arc Testnet · Last updated July 2026</p>
        </main>

        <aside className="docs-right-rail sticky top-[130px] hidden h-[calc(100dvh-130px)] py-10 pl-7 xl:block">
          <p className="docs-group-label">Network</p>
          <div className="mb-5 flex items-center gap-2 text-xs font-medium text-[#c4c8d8]"><span className="docs-network-dot" /> Arc Testnet</div>
          <dl className="space-y-3 text-[11px]">
            <div><dt>Chain ID</dt><dd>5042002</dd></div>
            <div><dt>Price oracle</dt><dd>Stork</dd></div>
          </dl>

          <div className="mt-8 border-t border-white/[0.07] pt-7">
            <p className="docs-group-label">Resources</p>
            <div className="space-y-3">
              <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">ArcScan <ExternalLink /></a>
              <a href="https://faucet.circle.com" target="_blank" rel="noreferrer">Circle Faucet <ExternalLink /></a>
              <a href="/lend">Open Vitael App <ArrowRight /></a>
            </div>
          </div>

          <div className="docs-testnet-note"><span>Testnet</span>Assets have no real-world value. Verify contract addresses before every interaction.</div>
        </aside>
      </div>
    </div>
  );
}
