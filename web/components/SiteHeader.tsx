"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { shortAddr } from "@/lib/retinue";

export function SiteHeader() {
  const { address, connect, disconnect, connecting, hasWallet, balanceWei } = useWallet();
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-4 lg:px-7 py-3"
      style={{ background: "var(--s1)", borderBottom: "1px solid var(--line)" }}
    >
      <Link href="/" className="flex items-center gap-2.5">
        {/* the calibration mark — the instrument that audits the work */}
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="9" fill="none" stroke="var(--signal)" strokeWidth="2.6" />
          <line x1="16" y1="2" x2="16" y2="8.5" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
          <line x1="16" y1="23.5" x2="16" y2="30" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
          <line x1="2" y1="16" x2="8.5" y2="16" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
          <line x1="23.5" y1="16" x2="30" y2="16" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="16" cy="16" r="3.2" fill="var(--signal)" />
        </svg>
        <span className="display text-lg">Retinue</span>
      </Link>

      <nav className="hidden md:flex items-center gap-5">
        <Link href="/" className="btn-link">Registry</Link>
        <Link href="/bench" className="btn-link">Bench</Link>
        <Link href="/offers" className="btn-link">Offers</Link>
        <Link href="/mandates" className="btn-link">My desk</Link>
        <Link href="/new" className="btn-link">New mandate</Link>
      </nav>

      <div className="flex items-center gap-3">
        {address ? (
          <div className="flex items-center gap-3">
            <span className="hidden lg:inline mono text-xs ink tabular">
              {balanceWei !== null ? `${(Number(balanceWei) / 1e18).toFixed(3)} GEN` : ""}
            </span>
            <button onClick={disconnect} className="btn-ghost" title={address} style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}>
              {shortAddr(address)}
            </button>
          </div>
        ) : (
          <button onClick={() => connect().catch(() => {})} disabled={connecting} className="btn">
            {connecting ? "Connecting…" : hasWallet ? "Connect" : "Get a wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
