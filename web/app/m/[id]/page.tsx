"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import {
  getMandate, getReviewsFor, acceptMandate, reviewWindow, appealRuling,
  finalizeRevoke, cancelMandate, genFromWei, shortAddr, appealBondWei,
  type Mandate, type Review,
} from "@/lib/retinue";
import { TEMPLATE_META } from "@/lib/config";
import { StatusChip, WindowMeter, ReviewEntry } from "@/components/Bits";

export default function MandateFile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { address, client, connect } = useWallet();
  const [m, setM] = useState<Mandate | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [appealText, setAppealText] = useState("");

  const load = useCallback(async () => {
    try {
      const mk = await getMandate(id);
      setM(mk);
      if (mk) getReviewsFor(id).then(setReviews).catch(() => {});
    } catch { setM(null); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function run(label: string, fn: () => Promise<unknown>) {
    if (!client) return connect().catch(() => {});
    setErr(""); setNote(""); setBusy(label);
    try {
      const out = await fn();
      // the LLM-outage fail-safe returns an INCONCLUSIVE no-op — surface it
      const o = out as { ruling?: string; note?: string } | null;
      if (o && o.ruling === "INCONCLUSIVE") setNote(o.note || "Review inconclusive — nothing changed, run it again.");
      await load();
      setAppealText("");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(""); }
  }

  if (loading) return <p className="max-w-3xl mx-auto px-5 py-24 text-sm muted">Reading the file…</p>;
  if (!m) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-24 text-center">
        <h1 className="display text-2xl">No such mandate</h1>
        <Link href="/" className="btn mt-6 inline-flex">Back to the registry</Link>
      </div>
    );
  }

  const me = address?.toLowerCase() ?? "";
  const isClient = me === m.client.toLowerCase();
  const isOperator = me === m.operator.toLowerCase();
  const reviewable = (m.status === "ACTIVE" || m.status === "CONSTRAINED") && (isClient || isOperator);
  const tmpl = TEMPLATE_META[m.template] ?? { label: m.template };

  const last = reviews[reviews.length - 1];
  const appealable = !!last && last.ruling !== "RELEASE" && !last.appealed
    && !["REVOKED", "CANCELLED"].includes(m.status) && isOperator;
  const bond = appealBondWei(m.rate_wei);

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-8">
      <Link href="/" className="btn-link mb-5 inline-flex">← Registry</Link>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="chip">{tmpl.label}</span>
        <StatusChip status={m.status} />
        {m.strikes > 0 && <span className="stamp stamp-warn">{m.strikes} strike{m.strikes > 1 ? "s" : ""}</span>}
        <span className="mono text-xs muted ml-auto">{m.mandate_id}</span>
      </div>
      <h1 className="display" style={{ fontSize: "clamp(22px, 3.2vw, 34px)" }}>{m.title}</h1>
      <p className="mono text-xs muted mt-2">
        client {shortAddr(m.client)}{isClient ? " (you)" : ""} · operator{" "}
        <Link href={`/u/${m.operator}`} className="link">{shortAddr(m.operator)}</Link>{isOperator ? " (you)" : ""}
      </p>

      {/* escrow strip */}
      <div className="grid grid-cols-3 gap-3 mt-5">
        <Strip label="In escrow" value={`${genFromWei(m.escrow_remaining_wei)} GEN`} />
        <Strip label="Per window" value={`${genFromWei(m.rate_wei)} GEN`} />
        <Strip label="Windows" value={`${m.windows_done}/${m.windows_total}`} />
      </div>
      <div className="mt-3"><WindowMeter m={m} /></div>

      {/* the mandate */}
      <div className="panel p-4 mt-5">
        <div className="eyebrow mb-2" style={{ color: "var(--signal)" }}>The mandate — the panel rules on these words</div>
        <p className="text-sm leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>{m.brief}</p>
        {m.constraint_note && (
          <div className="inset p-3 mt-3" style={{ borderColor: "var(--constrain)" }}>
            <div className="eyebrow mb-1" style={{ color: "var(--constrain)" }}>Active probation</div>
            <p className="text-[0.82rem]">{m.constraint_note}</p>
          </div>
        )}
        <div className="rule my-3" />
        <div className="eyebrow mb-1.5">Pinned surfaces · frozen at creation, fetched by validators</div>
        <div className="flex flex-col gap-1.5 mono text-xs">
          {m.surfaces.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="link break-all">{u} ↗</a>)}
        </div>
      </div>

      {/* acceptance gate */}
      {m.status === "PROPOSED" && (
        <div className="panel p-4 mt-4" style={{ borderColor: "var(--signal)" }}>
          <div className="eyebrow mb-1" style={{ color: "var(--signal)" }}>Awaiting operator acceptance</div>
          <p className="text-sm">
            Nothing can be judged and nothing touches the operator&apos;s record until they accept.
            Accepting means: <em>the surfaces are mine — judge the work from here on.</em>
          </p>
          {isOperator && (
            <button onClick={() => run("accept", () => acceptMandate(client, m.mandate_id))} disabled={!!busy} className="btn btn-signal mt-3">
              {busy === "accept" ? "Accepting…" : "Accept the mandate"}
            </button>
          )}
        </div>
      )}

      {/* revoke armed */}
      {m.status === "REVOKE_PENDING" && (
        <div className="panel p-4 mt-4" style={{ borderColor: "var(--revoke)" }}>
          <div className="eyebrow mb-1" style={{ color: "var(--revoke)" }}>Revoke armed — appeal window open</div>
          <p className="text-sm">
            The escrow does not move yet. The operator can post a bonded appeal below; anyone can
            execute the revoke once the window elapses (or the appeal is upheld).
          </p>
          <button onClick={() => run("finalize", () => finalizeRevoke(client, m.mandate_id))} disabled={!!busy} className="btn btn-danger mt-3">
            {busy === "finalize" ? "Executing…" : `Finalize revoke · return ${genFromWei(m.escrow_remaining_wei)} GEN to client`}
          </button>
        </div>
      )}

      {/* run a review */}
      {reviewable && (
        <div className="panel p-4 mt-4">
          <div className="eyebrow mb-1">Window {m.windows_done + 1} of {m.windows_total}</div>
          <p className="text-sm mb-3">
            Validators fetch the pinned surfaces live and rule them against the mandate.
            Either party may call it — the operator wants the window paid, the client wants the audit.
          </p>
          <button onClick={() => run("review", () => reviewWindow(client, m.mandate_id))} disabled={!!busy} className="btn">
            {busy === "review" ? "The panel is reading…" : "Run the review"}
          </button>
        </div>
      )}

      {/* appeal */}
      {appealable && (
        <div className="panel p-4 mt-4" style={{ borderColor: "var(--signal)" }}>
          <div className="eyebrow mb-1" style={{ color: "var(--signal)" }}>Appeal the last ruling · {last.review_id}</div>
          <p className="text-sm mb-2">
            Post a <span className="mono ink">{genFromWei(bond)} GEN</span> bond for a second panel
            round over the same surfaces, with your instructions in front of the panel. Flipped →
            effects unwound, bond returns. Upheld → bond to the client. Once per ruling.
          </p>
          <textarea value={appealText} onChange={(e) => setAppealText(e.target.value)} rows={3} maxLength={1500}
            placeholder="Tell the panel what the first round misread — point it at the exact post or section…" className="field text-sm" />
          <button
            onClick={() => run("appeal", () => appealRuling(client, last.review_id, appealText.trim(), bond))}
            disabled={!!busy || appealText.trim().length < 20}
            className="btn btn-signal mt-2"
          >
            {busy === "appeal" ? "Second round running…" : `Appeal · bond ${genFromWei(bond)} GEN`}
          </button>
        </div>
      )}

      {/* client cancel */}
      {isClient && (m.status === "PROPOSED" || m.status === "ACTIVE" || m.status === "CONSTRAINED") && (
        <div className="flex items-center gap-3 mt-4">
          <button onClick={() => run("cancel", () => cancelMandate(client, m.mandate_id))} disabled={!!busy} className="btn-link" style={{ color: "var(--revoke)" }}>
            {busy === "cancel" ? "Cancelling…" : `Cancel mandate · reclaim ${genFromWei(m.escrow_remaining_wei)} GEN`}
          </button>
          <span className="mono text-[0.6rem] muted">The operator keeps every window already earned.</span>
        </div>
      )}

      {err && <p className="text-sm mt-4" style={{ color: "var(--revoke)" }}>{err}</p>}
      {note && <p className="mono text-xs mt-4" style={{ color: "var(--warn)" }}>{note}</p>}

      {/* inspection log */}
      <div className="mt-7">
        <h2 className="display text-base mb-3">Inspection log <span className="mono text-xs muted">({reviews.length})</span></h2>
        {reviews.length === 0 ? (
          <p className="mono text-xs muted">No reviews yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.slice().reverse().map((rv) => <ReviewEntry key={rv.review_id} rv={rv} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Strip({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3.5">
      <div className="eyebrow mb-1">{label}</div>
      <div className="mono text-sm tabular ink">{value}</div>
    </div>
  );
}
