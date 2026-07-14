"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { getBench, registerOperator, genFromWei, genToWei, shortAddr, type OperatorProfile } from "@/lib/retinue";
import { Stat } from "@/components/Bits";

function grade(p: OperatorProfile): { label: string; color: string } {
  const r = p.record;
  if (!r || r.windows_served + r.revokes === 0) return { label: "UNRATED", color: "var(--muted)" };
  if (r.revokes > 0) return { label: "REVOKED ON RECORD", color: "var(--revoke)" };
  if (r.constrains > 0) return { label: "PROBATION HISTORY", color: "var(--constrain)" };
  if (r.warns > 0) return { label: "SERVED W/ WARNINGS", color: "var(--warn)" };
  return { label: "CLEAN SHEET", color: "var(--release)" };
}

export default function BenchPage() {
  const { address, client, connect } = useWallet();
  const [bench, setBench] = useState<OperatorProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState("");
  const [rate, setRate] = useState("1");
  const [portfolio, setPortfolio] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(() => { getBench(50).then(setBench).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const mine = address ? bench.find((p) => p.operator.toLowerCase() === address.toLowerCase()) : undefined;

  async function submit() {
    if (!client) return connect().catch(() => {});
    setErr(""); setBusy(true);
    try {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5);
      const pfList = portfolio.split("\n").map((u) => u.trim()).filter(Boolean).slice(0, 3);
      await registerOperator(client, handle.trim(), bio.trim(), tagList, genToWei(rate || "0"), pfList);
      setShowForm(false); load();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-6 py-8">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-2">
        <div>
          <p className="eyebrow mb-2">Layer 1 · discovery, identity &amp; reputation</p>
          <h1 className="display" style={{ fontSize: "clamp(24px,3.6vw,38px)" }}>The Bench</h1>
        </div>
        <button className="btn btn-signal" onClick={() => (address ? setShowForm((s) => !s) : connect().catch(() => {}))}>
          {mine ? "Update my listing" : "Take a seat on the bench"}
        </button>
      </div>
      <p className="text-sm muted mb-6" style={{ maxWidth: "64ch" }}>
        Operators list themselves; the reputation half of every card is written by panel rulings
        alone. Clients hire on the same record adjudication maintains — the loop that makes the
        rest of the stack mean something.
      </p>

      {/* registration — self-owned identity */}
      {showForm && (
        <div className="panel p-5 mb-6" style={{ borderTop: "3px solid var(--signal)" }}>
          <div className="eyebrow mb-3" style={{ color: "var(--signal)" }}>
            {mine ? "Update the listing" : "Register"} · only your wallet can write this profile
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="spec-key block mb-1">Handle (3–24, letters/digits/dashes)</label>
              <input className="input w-full" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={mine?.handle || "inkwell"} />
            </div>
            <div>
              <label className="spec-key block mb-1">Rate hint (GEN per window)</label>
              <input className="input w-full mono" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          </div>
          <label className="spec-key block mb-1 mt-3">Bio</label>
          <textarea className="input w-full text-sm" rows={2} maxLength={400} value={bio} onChange={(e) => setBio(e.target.value)}
            placeholder="Ghostwriter for developer tools. Founder voice, no fluff." />
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="spec-key block mb-1">Specialties (comma-separated, up to 5)</label>
              <input className="input w-full" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="devtools, founder-voice, threads" />
            </div>
            <div>
              <label className="spec-key block mb-1">Portfolio URLs (one per line, up to 3)</label>
              <textarea className="input w-full mono text-xs" rows={2} value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <button className="btn btn-signal mt-4" disabled={busy || handle.trim().length < 3} onClick={submit}>
            {busy ? "Writing to the bench…" : mine ? "Update listing" : "Register"}
          </button>
          {err && <p className="mono text-xs mt-2" style={{ color: "var(--revoke)" }}>{err}</p>}
        </div>
      )}

      {/* directory */}
      {bench.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm muted mb-1">The bench is empty.</p>
          <p className="mono text-[0.66rem] muted">First seat is free — and every seat is judged the same.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bench.map((p) => {
            const g = grade(p);
            const r = p.record;
            return (
              <div key={p.operator} className="panel p-4 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div style={{ minWidth: 0 }}>
                    <p className="display text-base">@{p.handle}</p>
                    <Link href={`/u/${p.operator}`} className="mono text-[0.64rem] link">{shortAddr(p.operator)}</Link>
                  </div>
                  <span className="mono text-[0.56rem]" style={{
                    color: g.color, border: `1.5px solid ${g.color}`, borderRadius: 4,
                    padding: "0.16rem 0.4rem", letterSpacing: "0.1em", whiteSpace: "nowrap",
                  }}>{g.label}</span>
                </div>
                {p.bio && <p className="text-[0.8rem] leading-relaxed" style={{
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>{p.bio}</p>}
                {p.specialties.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {p.specialties.map((t) => <span key={t} className="chip">{t}</span>)}
                  </div>
                )}
                <div className="flex items-center justify-between mono text-[0.62rem] muted mt-auto pt-2" style={{ borderTop: "1px dashed var(--line)" }}>
                  <span>{r ? `${r.windows_served} windows · ${r.completed} completed` : "no record yet"}</span>
                  <span>{genFromWei(p.rate_hint_wei)} GEN/wk</span>
                </div>
                <div className="flex gap-2">
                  <Link href={`/u/${p.operator}`} className="btn-ghost flex-1 text-center" style={{ fontSize: "0.74rem", padding: "0.4rem" }}>Dossier</Link>
                  <Link href={`/offers?to=${p.operator}`} className="btn btn-signal flex-1 text-center" style={{ fontSize: "0.74rem", padding: "0.4rem" }}>Propose terms</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
