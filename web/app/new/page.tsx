"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { TEMPLATES, TEMPLATE_META, MIN_WINDOWS, MAX_WINDOWS, MAX_SURFACES } from "@/lib/config";
import { retain, genToWei, genFromWei } from "@/lib/retinue";

type Probe = { state: "idle" | "checking" | "ok" | "bad"; note: string };

export default function NewMandate() {
  const router = useRouter();
  const { address, client, connect } = useWallet();

  const [operator, setOperator] = useState("");
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<string>("retainer");
  const [brief, setBrief] = useState("");
  const [surfaces, setSurfaces] = useState<string[]>([""]);
  const [probes, setProbes] = useState<Record<number, Probe>>({});
  const [windows, setWindows] = useState("4");
  const [total, setTotal] = useState("0.4");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const ratePreview = (() => {
    const n = Number(windows) || 0;
    if (n < 1 || !(Number(total) > 0)) return null;
    try { return genFromWei(genToWei(total) / BigInt(n)); } catch { return null; }
  })();

  function setSurface(i: number, v: string) {
    setSurfaces((s) => s.map((x, idx) => (idx === i ? v : x)));
    setProbes((p) => ({ ...p, [i]: { state: "idle", note: "" } }));
  }

  async function preflight(i: number) {
    const url = surfaces[i]?.trim();
    if (!url) return;
    setProbes((p) => ({ ...p, [i]: { state: "checking", note: "" } }));
    try {
      const res = await fetch("/api/preflight", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const d = await res.json();
      setProbes((p) => ({
        ...p,
        [i]: d.ok
          ? { state: "ok", note: `fetchable — "${d.sample?.slice(0, 80)}…"` }
          : { state: "bad", note: d.reason || "not fetchable" },
      }));
    } catch {
      setProbes((p) => ({ ...p, [i]: { state: "bad", note: "probe failed — try again" } }));
    }
  }

  async function submit() {
    if (!client) return connect().catch(() => {});
    setErr("");
    const surf = surfaces.map((s) => s.trim()).filter(Boolean);
    if (!/^0x[a-fA-F0-9]{40}$/.test(operator.trim())) return setErr("Operator must be a wallet address.");
    if (title.trim().length < 3) return setErr("Give the mandate a title.");
    if (brief.trim().length < 80) return setErr("Write the mandate brief — the panel rules on its words (min 80 chars).");
    if (surf.length < 1 || surf.length > MAX_SURFACES) return setErr(`Pin 1–${MAX_SURFACES} public surfaces.`);
    const n = Number(windows);
    if (!(n >= MIN_WINDOWS && n <= MAX_WINDOWS)) return setErr(`Windows must be ${MIN_WINDOWS}–${MAX_WINDOWS}.`);
    if (!(Number(total) > 0)) return setErr("Set the retainer total.");
    setBusy(true);
    try {
      const m = await retain(client, operator.trim(), title.trim(), template, brief.trim(), surf, n, genToWei(total));
      router.push(m?.mandate_id ? `/m/${m.mandate_id}` : "/mandates");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (!address) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <h1 className="display text-2xl">Open a mandate</h1>
        <p className="mt-3 text-sm muted">Connect a wallet to retain an operator.</p>
        <button onClick={() => connect().catch(() => {})} className="btn btn-signal mt-6">Connect</button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 lg:px-6 py-8">
      <p className="eyebrow mb-2">New mandate · you are the client</p>
      <h1 className="display" style={{ fontSize: "clamp(24px,4vw,36px)" }}>Retain an operator</h1>

      <div className="panel p-5 mt-6 flex flex-col gap-4">
        <Field label="Operator wallet">
          <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="0x… — they must accept before anything is judged" className="field mono text-sm" />
        </Field>

        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Acme brand blog stewardship" className="field" />
        </Field>

        <Field label="Template">
          <div className="scroll-x">
            {TEMPLATES.map((t) => (
              <button key={t} onClick={() => setTemplate(t)} className={t === template ? "btn" : "btn-ghost"} style={{ padding: "0.4rem 0.85rem", fontSize: "0.78rem", flex: "0 0 auto" }}>
                {TEMPLATE_META[t].label}
              </button>
            ))}
          </div>
          <p className="mono text-[0.62rem] muted mt-1.5">{TEMPLATE_META[template].hint}</p>
        </Field>

        <Field label="The mandate — the panel rules on these words">
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={5} maxLength={2400} className="field text-sm"
            placeholder={"Voice: plain-spoken, technical, no hype.\nTopics: our product, the industry; never politics, never competitors by name.\nCadence: fresh post each window. Disclosure: #ad on anything sponsored.\nProhibited: giveaways, engagement bait, AI-sounding filler."} />
        </Field>

        <Field label={`Pinned surfaces (1–${MAX_SURFACES}) — frozen at creation; validators fetch these`}>
          <div className="flex flex-col gap-2">
            {surfaces.map((s, i) => (
              <div key={i}>
                <div className="flex gap-2">
                  <input value={s} onChange={(e) => setSurface(i, e.target.value)} placeholder="https://blog.example.com (public, fetchable)" className="field mono text-sm" />
                  <button onClick={() => preflight(i)} disabled={!s.trim() || probes[i]?.state === "checking"} className="btn-ghost" style={{ padding: "0.4rem 0.8rem", fontSize: "0.74rem", flex: "0 0 auto" }}>
                    {probes[i]?.state === "checking" ? "Probing…" : "Preflight"}
                  </button>
                </div>
                {probes[i]?.state === "ok" && <p className="mono text-[0.62rem] mt-1" style={{ color: "var(--release)" }}>✓ {probes[i].note}</p>}
                {probes[i]?.state === "bad" && <p className="mono text-[0.62rem] mt-1" style={{ color: "var(--revoke)" }}>✕ {probes[i].note}</p>}
              </div>
            ))}
            {surfaces.length < MAX_SURFACES && (
              <button onClick={() => setSurfaces((s) => [...s, ""])} className="btn-link self-start">+ add a surface</button>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Review windows (${MIN_WINDOWS}–${MAX_WINDOWS})`}>
            <input value={windows} onChange={(e) => setWindows(e.target.value)} inputMode="numeric" className="field mono" />
          </Field>
          <Field label="Retainer total (GEN)">
            <input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" className="field mono" />
          </Field>
        </div>
        {ratePreview && (
          <p className="mono text-[0.66rem] muted">
            ≈ {ratePreview} GEN per window, released only against a passing review. Unspent escrow returns to you on revoke or cancel.
          </p>
        )}

        <button onClick={submit} disabled={busy} className="btn btn-signal w-full">
          {busy ? "Escrowing…" : `Escrow ${total || "0"} GEN and propose`}
        </button>
        {err && <p className="text-xs" style={{ color: "var(--revoke)" }}>{err}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="eyebrow mb-2">{label}</div>{children}</div>;
}
