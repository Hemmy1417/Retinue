"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRegistry, getStats, genFromWei, type Mandate, type Stats } from "@/lib/retinue";
import { MandateCard, Stat } from "@/components/Bits";

export default function Registry() {
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getRegistry(30).then(setMandates).catch(() => {});
    getStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-8">
      {/* hero */}
      <section className="panel p-6 sm:p-8 mb-5 fade-in" style={{ borderTop: "3px solid var(--signal)" }}>
        <p className="eyebrow mb-2">Standing supervision · contract-fetched evidence · bonded appeals</p>
        <h1 className="display" style={{ fontSize: "clamp(26px, 4vw, 44px)" }}>
          The retainer that audits <span style={{ color: "var(--signal)" }}>the work itself</span>.
        </h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ maxWidth: "62ch" }}>
          Escrow a retainer for a content operator — an agency, a ghostwriter, an AI posting
          agent — under a written mandate with pinned public surfaces. At every review window,
          GenLayer validators fetch the live pages themselves and rule the actual output:
          release the pay, warn, constrain, or revoke. No self-reported evidence, ever.
        </p>
        <div className="flex gap-2 mt-5">
          <Link href="/new" className="btn btn-signal">Open a mandate</Link>
          <Link href="/mandates" className="btn-ghost">My desk</Link>
        </div>
      </section>

      {/* protocol strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Mandates" value={stats ? String(stats.total_mandates) : "—"} />
        <Stat label="Reviews ruled" value={stats ? String(stats.total_reviews) : "—"} />
        <Stat label="In escrow" value={stats ? `${genFromWei(stats.escrowed_wei)} GEN` : "—"} />
        <Stat label="Released to operators" value={stats ? `${genFromWei(stats.paid_out_wei)} GEN` : "—"} />
      </div>

      {/* how it runs */}
      <section className="grid sm:grid-cols-4 gap-3 mb-8">
        {[
          ["01 · Retain", "Escrow the full retainer. Pin the mandate brief and 1–3 public surfaces — frozen, nobody swaps the evidence."],
          ["02 · Accept", "Nothing judges an operator who didn't consent. Accepting means: the surfaces are mine, judge from here."],
          ["03 · Review", "Each window, validators fetch the live pages and rule them against the mandate. Release · Warn · Constrain · Revoke."],
          ["04 · Appeal", "Adverse ruling? The operator posts a bond for a second round with their instructions in front of the panel."],
        ].map(([t, d]) => (
          <div key={t} className="panel p-4">
            <div className="eyebrow mb-2" style={{ color: "var(--signal)" }}>{t}</div>
            <p className="text-[0.82rem] leading-relaxed">{d}</p>
          </div>
        ))}
      </section>

      {/* registry */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="display text-lg">Mandates of record</h2>
      </div>
      {mandates.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm muted">No mandates yet. Open the first one.</p>
          <Link href="/new" className="btn btn-signal mt-4 inline-flex">Open a mandate</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mandates.map((m) => <MandateCard key={m.mandate_id} m={m} />)}
        </div>
      )}
    </div>
  );
}
