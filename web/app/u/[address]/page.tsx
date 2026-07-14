"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { getOperatorRecord, getMandatesForOperator, shortAddr, type OperatorRecord, type Mandate } from "@/lib/retinue";
import { EXPLORER_URL } from "@/lib/config";
import { MandateCard, Stat } from "@/components/Bits";

function standing(rec: OperatorRecord | null): { label: string; color: string; note: string } {
  if (!rec || rec.windows_served + rec.revokes === 0) {
    return { label: "UNRATED", color: "var(--muted)", note: "No windows on file yet — a record begins the first time this operator's work is reviewed." };
  }
  if (rec.revokes > 0)   return { label: "REVOKED ON RECORD", color: "var(--revoke)", note: "At least one mandate ended in revocation. The record keeps it forever." };
  if (rec.constrains > 0) return { label: "PROBATION HISTORY", color: "var(--constrain)", note: "Served under at least one probation constraint. Later clean windows stand next to it." };
  if (rec.warns > 0)     return { label: "SERVED WITH WARNINGS", color: "var(--warn)", note: "Warnings on file, no probation, no revocation." };
  return { label: "CLEAN SHEET", color: "var(--release)", note: "Every reviewed window released clean." };
}

export default function OperatorProfile({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const [rec, setRec] = useState<OperatorRecord | null>(null);
  const [mandates, setMandates] = useState<Mandate[]>([]);

  useEffect(() => {
    getOperatorRecord(address).then(setRec).catch(() => {});
    getMandatesForOperator(address).then(setMandates).catch(() => {});
  }, [address]);

  const served = rec?.windows_served ?? 0;
  const clean = rec ? Math.max(0, served - rec.warns - rec.constrains) : 0;
  const cleanPct = served > 0 ? Math.round((clean / served) * 100) : 0;
  const grade = standing(rec);

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-6 py-8">
      {/* ── dossier header ── */}
      <section className="panel p-6 sm:p-7 mb-4" style={{ borderTop: "3px solid var(--signal)" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow mb-2">Operator dossier · public and portable</p>
            <h1 className="display mono" style={{ fontSize: "clamp(17px,2.6vw,24px)", wordBreak: "break-all" }}>{address}</h1>
            <p className="text-sm muted mt-2" style={{ maxWidth: "58ch" }}>
              The record is the one deliberately public thing on Retinue: how this operator&apos;s
              work held up under standing review, written one ruling at a time. It follows{" "}
              {shortAddr(address)} to every future mandate — no client has to take their word for it.
            </p>
          </div>
          <div className="text-center" style={{ flex: "0 0 auto" }}>
            <span
              className="mono stamp-in"
              style={{
                display: "inline-block", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.14em",
                color: grade.color, border: `2px solid ${grade.color}`, borderRadius: 6,
                padding: "0.5rem 0.9rem", transform: "rotate(-3deg)",
              }}
            >
              {grade.label}
            </span>
            <p className="mono text-[0.6rem] muted mt-2" style={{ maxWidth: 190 }}>{grade.note}</p>
          </div>
        </div>

        {/* reliability meter */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="spec-key">Clean-window ratio</span>
            <span className="mono text-xs ink tabular">{served > 0 ? `${cleanPct}% · ${clean} of ${served}` : "no readings yet"}</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "var(--s3)", overflow: "hidden" }}>
            <span style={{
              display: "block", height: "100%", width: served > 0 ? `${cleanPct}%` : "0%",
              background: served > 0 ? grade.color : "var(--s3)", borderRadius: 999, transition: "width .5s ease",
            }} />
          </div>
        </div>
      </section>

      {/* ── the counters ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <Stat label="Windows served" value={rec ? String(served) : "—"} hint={rec ? `${clean} released clean` : undefined} />
        <Stat label="Mandates completed" value={rec ? String(rec.completed) : "—"} />
        <Stat label="Warns / constrains" value={rec ? `${rec.warns} / ${rec.constrains}` : "—"} />
        <Stat label="Revokes" value={rec ? String(rec.revokes) : "—"} />
        <Stat label="Appeals won" value={rec ? String(rec.appeals_won) : "—"} hint="rulings overturned" />
        <Stat label="Appeals lost" value={rec ? String(rec.appeals_lost) : "—"} hint="bonds forfeited" />
      </div>

      {/* ── how a record gets written ── */}
      <section className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="panel p-5">
          <div className="eyebrow mb-3" style={{ color: "var(--signal)" }}>How each line gets written</div>
          <div className="flex flex-col">
            <div className="spec-row"><span className="spec-key">Released window</span><span className="spec-val" style={{ color: "var(--release)" }}>windows served +1</span></div>
            <div className="spec-row"><span className="spec-key">Warned window</span><span className="spec-val" style={{ color: "var(--warn)" }}>served +1 · warns +1</span></div>
            <div className="spec-row"><span className="spec-key">Constrained window</span><span className="spec-val" style={{ color: "var(--constrain)" }}>served +1 · constrains +1</span></div>
            <div className="spec-row"><span className="spec-key">Revocation finalized</span><span className="spec-val" style={{ color: "var(--revoke)" }}>revokes +1</span></div>
            <div className="spec-row"><span className="spec-key">Final window released</span><span className="spec-val">completed +1</span></div>
          </div>
          <p className="mono text-[0.62rem] muted mt-3 leading-relaxed">
            Every line is written by a validator-panel ruling over pages the validators fetched
            themselves — never by the client, never by the operator.
          </p>
        </div>
        <div className="panel p-5">
          <div className="eyebrow mb-3" style={{ color: "var(--signal)" }}>Due process, on the record</div>
          <div className="flex flex-col gap-3">
            {([
              ["Consent first", "Nothing here was written without this operator's acceptance — a mandate judges nobody until the named operator signs on."],
              ["Appeals correct the record", "A flipped appeal doesn't just return the bond: it rewrites the counters. An overturned warn becomes a released window, retroactively."],
              ["Losses cost something too", "A lost appeal forfeits the bond to the client and goes on the record — second looks are a right, not a slot machine."],
            ] as [string, string][]).map(([t, d]) => (
              <div key={t} className="clause">
                <span className="clause-no">▸</span>
                <div>
                  <p className="body-strong text-[0.84rem]">{t}</p>
                  <p className="text-[0.8rem] leading-relaxed mt-0.5">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── mandates ── */}
      <div className="flex items-center justify-between mb-3 mt-6">
        <h2 className="display text-lg">Mandates on file</h2>
        <a href={`${EXPLORER_URL}/address/${address}`} target="_blank" rel="noreferrer" className="btn-link">wallet on explorer ↗</a>
      </div>
      {mandates.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="text-sm muted mb-1">Nothing on file.</p>
          <p className="mono text-[0.66rem] muted" style={{ maxWidth: "46ch", margin: "0 auto" }}>
            A dossier opens the first time this operator accepts a mandate. If that&apos;s you,
            the desk is waiting; if you&apos;re a client, retain them and see how the work holds.
          </p>
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
