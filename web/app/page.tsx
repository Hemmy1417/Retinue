"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRegistry, getStats, genFromWei, type Mandate, type Stats } from "@/lib/retinue";
import { CONTRACT_ADDRESS, EXPLORER_URL } from "@/lib/config";
import { MandateCard, Stat, RulingStamp } from "@/components/Bits";

export default function Registry() {
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getRegistry(30).then(setMandates).catch(() => {});
    getStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-8">
      {/* ── hero: pitch + specimen card ── */}
      <section className="grid lg:grid-cols-[1.15fr_1fr] gap-4 mb-5 items-stretch">
        <div className="panel p-6 sm:p-8 fade-in flex flex-col justify-center" style={{ borderTop: "3px solid var(--signal)" }}>
          <p className="eyebrow mb-2">Standing supervision · contract-fetched evidence · bonded appeals</p>
          <h1 className="display" style={{ fontSize: "clamp(26px, 4vw, 44px)" }}>
            The retainer that audits <span style={{ color: "var(--signal)" }}>the work itself</span>.
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ maxWidth: "62ch" }}>
            You hand your public voice to an agency, a ghostwriter, an AI posting agent — and the
            mandate lives in a PDF nobody can enforce. Retinue escrows the retainer and puts a
            GenLayer validator panel on the account: at every review window it fetches the live
            pages <em>itself</em> and rules the actual output against the mandate&apos;s own words.
            No screenshots, no reports, no self-supplied evidence. The deliverable is the page.
          </p>
          <div className="flex gap-2 mt-5">
            <Link href="/new" className="btn btn-signal">Open a mandate</Link>
            <Link href="/mandates" className="btn-ghost">My desk</Link>
          </div>
        </div>

        {/* specimen inspection card — a worked example, labeled as one */}
        <div className="panel specimen p-5 fade-in" style={{ background: "var(--s1)" }}>
          <div className="eyebrow mb-3">Window review · what a ruling looks like</div>
          <div className="inset p-3 mb-3">
            <div className="spec-key mb-1">Mandate excerpt</div>
            <p className="text-[0.8rem] leading-relaxed ink">
              “Voice: plain-spoken, technical. Fresh post each window. Never politics,
              never competitors by name. #ad on anything sponsored.”
            </p>
          </div>
          <div className="flex flex-col gap-0">
            <div className="spec-row"><span className="spec-key">Surface fetched</span><span className="spec-val">blog.acme.example ↗</span></div>
            <div className="spec-row"><span className="spec-key">Compliance</span><span className="spec-val" style={{ color: "var(--release)" }}>ON MANDATE</span></div>
            <div className="spec-row"><span className="spec-key">Presence</span><span className="spec-val" style={{ color: "var(--release)" }}>ACTIVE</span></div>
            <div className="spec-row"><span className="spec-key">Prohibited content</span><span className="spec-val">NONE</span></div>
            <div className="spec-row"><span className="spec-key">Injection attempt</span><span className="spec-val">NONE</span></div>
            <div className="spec-row"><span className="spec-key">Confidence</span><span className="spec-val">94</span></div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="stamp stamp-release stamp-in" style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem" }}>Release</span>
            <span className="mono text-[0.66rem]" style={{ color: "var(--release)" }}>window paid → operator</span>
          </div>
        </div>
      </section>

      {/* ── protocol strip (live reads) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Mandates" value={stats ? String(stats.total_mandates) : "—"} />
        <Stat label="Reviews ruled" value={stats ? String(stats.total_reviews) : "—"} />
        <Stat label="In escrow" value={stats ? `${genFromWei(stats.escrowed_wei)} GEN` : "—"} />
        <Stat label="Released to operators" value={stats ? `${genFromWei(stats.paid_out_wei)} GEN` : "—"} />
      </div>

      {/* ── the ruling ladder ── */}
      <section className="panel p-5 sm:p-6 mb-5">
        <div className="eyebrow mb-1" style={{ color: "var(--signal)" }}>The ruling ladder</div>
        <p className="text-sm mb-4" style={{ maxWidth: "62ch" }}>
          Four rulings, each with a money effect the contract enforces itself — the panel judges,
          the code moves (or refuses to move) the escrow.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {([
            ["RELEASE", "Window paid in full. The work held to the mandate.", "pay flows"],
            ["WARN", "Paid — but a strike goes on the record. Two strikes escalate the next one.", "pay + strike"],
            ["CONSTRAIN", "Paid, probation begins: the panel writes the constraint, the next round holds the operator to it strictly.", "pay + probation"],
            ["REVOKE", "Nothing pays and nothing drains: the revoke arms and waits out a bonded-appeal window before a single wei moves.", "armed, not executed"],
          ] as [string, string, string][]).map(([r, d, fx]) => (
            <div key={r} className="inset p-4">
              <RulingStamp ruling={r} />
              <p className="text-[0.8rem] leading-relaxed mt-2.5">{d}</p>
              <p className="mono text-[0.6rem] muted mt-2 uppercase tracking-wider">{fx}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── how it runs ── */}
      <section className="grid sm:grid-cols-4 gap-3 mb-5">
        {[
          ["01 · Retain", "Escrow the full retainer. Pin the mandate brief and 1–3 public surfaces — frozen, nobody swaps the evidence."],
          ["02 · Accept", "Nothing judges an operator who didn't consent. Accepting means: the surfaces are mine, judge from here."],
          ["03 · Review", "Each window, validators fetch the live pages and rule them against the mandate. Either party can call it."],
          ["04 · Appeal", "Adverse ruling? The operator posts a bond for a second round with their instructions in front of the panel."],
        ].map(([t, d]) => (
          <div key={t} className="panel p-4">
            <div className="eyebrow mb-2" style={{ color: "var(--signal)" }}>{t}</div>
            <p className="text-[0.82rem] leading-relaxed">{d}</p>
          </div>
        ))}
      </section>

      {/* ── who it's for + calibration ── */}
      <section className="grid lg:grid-cols-[1.2fr_1fr] gap-4 mb-5">
        <div className="panel p-5 sm:p-6">
          <div className="eyebrow mb-1" style={{ color: "var(--signal)" }}>Three mandates it was built for</div>
          <div className="flex flex-col gap-4 mt-3">
            {([
              ["Retainer", "The agency runs your blog and socials. The mandate pins voice, topics, cadence, prohibitions — and every window the panel reads what actually went out under your name."],
              ["Sponsorship", "The influencer posts the placement, pockets the fee, and quietly deletes it two days later. Here the placement is a pinned surface: gone means no more windows pay, and the escrow walks home."],
              ["Takeover", "A launch-week campaign run by someone else's hands — or an AI agent's. Bounded windows, standing review, and a record of how it behaved when nobody was watching."],
            ] as [string, string][]).map(([t, d]) => (
              <div key={t} className="clause">
                <span className="clause-no">▸</span>
                <div>
                  <p className="body-strong text-sm">{t}</p>
                  <p className="text-[0.82rem] leading-relaxed mt-0.5">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* calibration table — real parameters, read live */}
        <div className="panel p-5 sm:p-6">
          <div className="eyebrow mb-3" style={{ color: "var(--signal)" }}>Calibration · read from the contract</div>
          <div className="flex flex-col">
            <div className="spec-row"><span className="spec-key">Review windows</span><span className="spec-val">{stats ? `${stats.windows_range[0]}–${stats.windows_range[1]} per mandate` : "—"}</span></div>
            <div className="spec-row"><span className="spec-key">Minimum retainer</span><span className="spec-val">{stats ? `${genFromWei(stats.min_retainer_wei)} GEN` : "—"}</span></div>
            <div className="spec-row"><span className="spec-key">Appeal bond</span><span className="spec-val">{stats ? `${stats.appeal_bond_bps / 100}% of window · min ${genFromWei(stats.min_appeal_bond_wei)} GEN` : "—"}</span></div>
            <div className="spec-row"><span className="spec-key">Revoke appeal window</span><span className="spec-val">{stats ? `${stats.appeal_window_actions} protocol actions` : "—"}</span></div>
            <div className="spec-row"><span className="spec-key">Strikes to escalate</span><span className="spec-val">{stats ? String(stats.strikes_to_escalate) : "—"}</span></div>
            <div className="spec-row"><span className="spec-key">Returned to clients</span><span className="spec-val">{stats ? `${genFromWei(stats.refunded_wei)} GEN` : "—"}</span></div>
          </div>
          <p className="mono text-[0.6rem] muted mt-3 leading-relaxed">
            No owner. No admin keys. No pooled funds. Each mandate is its own escrow with a
            solvency book.
          </p>
        </div>
      </section>

      {/* ── trust clauses ── */}
      <section className="panel p-5 sm:p-6 mb-8">
        <div className="eyebrow mb-1" style={{ color: "var(--signal)" }}>Why the evidence can&apos;t lie</div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 mt-3">
          {([
            ["RT-01", "Surfaces are pinned at creation and frozen. The operator can never swap the evidence out from under a review."],
            ["RT-02", "Validators fetch the pages themselves, in consensus. The contract never accepts a screenshot, a report, or any party-supplied evidence."],
            ["RT-03", "Consent gates everything. A mandate judges nobody until the named operator accepts it — a record can't be poisoned by a stranger."],
            ["RT-04", "Content that tries to instruct the reviewer is itself a violation. Prompt injection floors the ruling at CONSTRAIN, deterministically."],
            ["RT-05", "A revoke never drains escrow in the breath that ruled it. It arms, and the bonded-appeal window stands between the ruling and the money."],
            ["RT-06", "An LLM-provider outage cannot corrupt a ruling: the round degrades to a no-op — nothing paid, nothing struck, nothing consumed."],
          ] as [string, string][]).map(([no, text]) => (
            <div key={no} className="clause">
              <span className="clause-no">{no}</span>
              <p className="text-[0.82rem] leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── registry ── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="display text-lg">Mandates of record</h2>
        {mandates.length > 0 && <span className="mono text-xs muted">{mandates.length} on the bench</span>}
      </div>
      {mandates.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm muted">The bench is clear. Open the first mandate.</p>
          <Link href="/new" className="btn btn-signal mt-4 inline-flex">Open a mandate</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mandates.map((m) => <MandateCard key={m.mandate_id} m={m} />)}
        </div>
      )}

      {/* ── footer ── */}
      <footer className="mt-10 pt-5 flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--line)" }}>
        <p className="mono text-[0.62rem] muted">
          Retinue · standing supervision on GenLayer ·{" "}
          <a href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" className="link">
            verify the contract ↗
          </a>
        </p>
        <div className="flex gap-4">
          <a href="https://genlayer.com" target="_blank" rel="noreferrer" className="btn-link">GenLayer</a>
          <a href="https://studio.genlayer.com" target="_blank" rel="noreferrer" className="btn-link">Studio</a>
          <a href="https://docs.genlayer.com" target="_blank" rel="noreferrer" className="btn-link">Docs</a>
        </div>
      </footer>
    </div>
  );
}
