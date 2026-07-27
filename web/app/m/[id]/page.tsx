"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { useTx } from "@/lib/tx";
import {
  getMandate, getReviewsFor, acceptMandate, reviewWindow, appealRuling, postWindowNote,
  finalizeRevoke, cancelMandate, finalizeCancel, forfeitWindow, getAcceptQuote, awaitReceipt,
  genFromWei, shortAddr, appealBondWei,
  type Mandate, type Review, type AcceptQuote, docketNo} from "@/lib/retinue";
import { TEMPLATE_META } from "@/lib/config";
import { StatusChip, WindowMeter, ReviewEntry } from "@/components/Bits";

export default function MandateFile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { address, client, connect } = useWallet();
  const tx = useTx();
  const [m, setM] = useState<Mandate | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [appealText, setAppealText] = useState("");
  const [quote, setQuote] = useState<AcceptQuote | null>(null);

  const load = useCallback(async () => {
    try {
      const mk = await getMandate(id);
      setM(mk);
      if (mk) getReviewsFor(id).then(setReviews).catch(() => {});
      if (mk?.status === "PROPOSED") getAcceptQuote(id).then(setQuote).catch(() => {});
    } catch { setM(null); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  /**
   * Every write goes through the transaction lifecycle.
   *
   * `settled` is the part that matters: it polls a contract view until the change is
   * actually readable, because a GenLayer receipt says ACCEPTED, not "views updated".
   * Refreshing the instant the receipt lands re-renders the same pre-transaction state
   * and the page looks like nothing happened.
   */
  async function run(
    tag: string,
    opts: {
      label: string; detail?: string; effect?: string;
      send: () => Promise<string>;
      settled?: () => Promise<boolean>;
    },
  ) {
    if (!client) return connect().catch(() => {});
    setErr(""); setNote(""); setBusy(tag);
    try {
      await tx.run({
        label: opts.label,
        detail: opts.detail,
        effect: opts.effect,
        send: opts.send,
        confirm: async (h) => {
          const out = await awaitReceipt<{ ruling?: string; note?: string }>(client, h);
          // The LLM-outage fail-safe returns an INCONCLUSIVE no-op — surface it rather
          // than letting a "confirmed" toast imply the mandate actually moved.
          if (out?.ruling === "INCONCLUSIVE") {
            setNote(out.note || "Review inconclusive — nothing changed, run it again.");
          }
          return out;
        },
        settled: opts.settled,
        onSettled: async () => { await load(); setAppealText(""); },
      });
    } catch {
      /* the toast owns the error */
    } finally {
      setBusy("");
    }
  }

  /** Poll until the mandate leaves the state it was in when we started. */
  const mandateLeft = (from: string) => async () => {
    const mk = await getMandate(id);
    return !!mk && mk.status !== from;
  };
  /** Poll until a new review has been written to the record. */
  const reviewAdded = (before: number) => async () =>
    (await getReviewsFor(id).catch(() => [])).length > before;

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
        <span className="eyebrow ml-auto" style={{ color: "var(--signal)" }}>Mandate No. {docketNo(m.mandate_id)}</span>
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
            Accepting posts a <strong>performance bond of {quote ? genFromWei(quote.required_bond_wei) : "…"} GEN</strong>:
            it comes home in full on a clean completion, and is slashed to the client on a final revoke or any
            window let go stale. <em>The surfaces are mine — judge the work from here on.</em>
          </p>
          {quote && quote.discount_bps > 0 && (
            <p className="mono text-[0.66rem] mt-1" style={{ color: "var(--release)" }}>
              Reputation {quote.operator_reputation}/100 → {(quote.discount_bps / 100).toFixed(0)}% bond discount
              (base {genFromWei(quote.base_bond_wei)} GEN). Your on-chain record earns cheaper capital.
            </p>
          )}
          {isOperator && quote && (
            <button onClick={() => run("accept", {
              label: "Accept the mandate",
              detail: `${m.title} · bond ${genFromWei(quote.required_bond_wei)} GEN`,
              effect: "Accepted — the mandate is live and the bond is posted.",
              send: () => acceptMandate(client, m.mandate_id, BigInt(quote.required_bond_wei)),
              settled: mandateLeft("PROPOSED"),
            })} disabled={!!busy} className="btn btn-signal mt-3">
              {busy === "accept" ? "Accepting…" : `Accept & post ${genFromWei(quote.required_bond_wei)} GEN bond`}
            </button>
          )}
        </div>
      )}

      {/* timed cadence + permissionless forfeit */}
      {Number(m.window_interval_seconds) > 0
        && ["ACTIVE", "CONSTRAINED", "CANCEL_PENDING"].includes(m.status)
        && m.windows_done < m.windows_total && (() => {
        const now = Math.floor(Date.now() / 1000);
        const dl = Number(m.window_deadline_epoch);
        const overdue = dl > 0 && now > dl;
        const hrs = dl > 0 ? Math.max(0, Math.round((dl - now) / 3600)) : 0;
        return (
          <div className="panel p-4 mt-4" style={{ borderColor: overdue ? "var(--revoke)" : "var(--constrain)" }}>
            <div className="eyebrow mb-1">Timed cadence · {Math.round(Number(m.window_interval_seconds) / 3600)}h per window</div>
            <p className="text-sm">
              {dl <= 0
                ? "Deadline not armed yet — run the first review to anchor the clock."
                : overdue
                ? "This window is overdue. Anyone can forfeit it — the tranche returns to the client and a miss lands on the operator's record."
                : `Next window due in ~${hrs}h.`}
              {m.forfeits_count > 0 && <span className="mono muted"> · {m.forfeits_count} forfeited</span>}
            </p>
            {overdue && (
              <button onClick={() => { const done = m.windows_done; return run("forfeit", {
                label: "Forfeit the window",
                detail: `${m.title} · window ${done + 1}`,
                effect: `${genFromWei(m.rate_wei)} GEN returned to the client; a miss lands on the record.`,
                send: () => forfeitWindow(client, m.mandate_id),
                settled: async () => {
                  const mk = await getMandate(id);
                  return !!mk && Number(mk.forfeits_count) > Number(m.forfeits_count);
                },
              }); }} disabled={!!busy} className="btn btn-danger mt-3">
                {busy === "forfeit" ? "Forfeiting…" : `Forfeit window · reclaim ${genFromWei(m.rate_wei)} GEN for client`}
              </button>
            )}
          </div>
        );
      })()}

      {/* revoke armed */}
      {m.status === "REVOKE_PENDING" && (
        <div className="panel p-4 mt-4" style={{ borderColor: "var(--revoke)" }}>
          <div className="eyebrow mb-1" style={{ color: "var(--revoke)" }}>Revoke armed — appeal window open</div>
          <p className="text-sm">
            The escrow does not move yet. The operator can post a bonded appeal below; anyone can
            execute the revoke once the window elapses (or the appeal is upheld).
          </p>
          <button onClick={() => run("finalize", {
            label: "Finalize the revoke",
            detail: m.title,
            effect: `${genFromWei(m.escrow_remaining_wei)} GEN returned to the client.`,
            send: () => finalizeRevoke(client, m.mandate_id),
            settled: mandateLeft("REVOKE_PENDING"),
          })} disabled={!!busy} className="btn btn-danger mt-3">
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

          {/* layer 5: the operator's note — advocacy, never evidence */}
          {isOperator && (
            <div className="inset p-3 mb-3">
              <label className="spec-key block mb-1">
                Window note · points the panel at the work — advocacy, never evidence, cleared after the ruling
              </label>
              {m.window_note ? (
                <p className="text-[0.8rem]">“{m.window_note}” <span className="mono text-[0.6rem] muted">— on file for this window</span></p>
              ) : (
                <div className="flex gap-2">
                  <input className="input w-full text-sm" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="This window's posts are the two dated July 14, below the pinned header." />
                  <button className="btn-ghost" style={{ fontSize: "0.76rem", whiteSpace: "nowrap" }}
                    disabled={!!busy || noteDraft.trim().length < 10}
                    onClick={() => run("note", {
                      label: "File the window note",
                      detail: m.title,
                      effect: "Filed — the panel will see it as advocacy, not evidence.",
                      send: () => postWindowNote(client, m.mandate_id, noteDraft.trim()),
                      settled: async () => !!(await getMandate(id))?.window_note,
                    }).then(() => setNoteDraft(""))}>
                    {busy === "note" ? "Filing…" : "File note"}
                  </button>
                </div>
              )}
            </div>
          )}

          <button onClick={() => { const n = reviews.length; return run("review", {
            label: "Run the review",
            detail: `${m.title} · window ${m.windows_done + 1} of ${m.windows_total}`,
            effect: "The panel has ruled — the record is written.",
            send: () => reviewWindow(client, m.mandate_id),
            settled: reviewAdded(n),
          }); }} disabled={!!busy} className="btn">
            {busy === "review" ? "The panel is reading…" : "Run the review"}
          </button>
        </div>
      )}

      {/* appeal */}
      {appealable && (
        <div className="panel p-4 mt-4" style={{ borderColor: "var(--signal)" }}>
          <div className="eyebrow mb-1" style={{ color: "var(--signal)" }}>Appeal the last ruling · Review {docketNo(last.review_id)}</div>
          <p className="text-sm mb-2">
            Post a <span className="mono ink">{genFromWei(bond)} GEN</span> bond for a second panel
            round over the same surfaces, with your instructions in front of the panel. Flipped →
            effects unwound, bond returns. Upheld → bond to the client. Once per ruling.
          </p>
          <textarea value={appealText} onChange={(e) => setAppealText(e.target.value)} rows={3} maxLength={1500}
            placeholder="Tell the panel what the first round misread — point it at the exact post or section…" className="field text-sm" />
          <button
            onClick={() => run("appeal", {
              label: "Appeal the ruling",
              detail: `Review ${docketNo(last.review_id)} · bond ${genFromWei(bond)} GEN`,
              effect: "The second panel has ruled — see the appeal outcome on the record.",
              send: () => appealRuling(client, last.review_id, appealText.trim(), bond),
              settled: async () => {
                const rs = await getReviewsFor(id).catch(() => []);
                return rs.some((r) => r.review_id === last.review_id && !!r.appeal_outcome);
              },
            })}
            disabled={!!busy || appealText.trim().length < 20}
            className="btn btn-signal mt-2"
          >
            {busy === "appeal" ? "Second round running…" : `Appeal · bond ${genFromWei(bond)} GEN`}
          </button>
        </div>
      )}

      {/* cancel armed — the operator's window to claim earned work */}
      {m.status === "CANCEL_PENDING" && (
        <div className="panel p-4 mt-4" style={{ borderColor: "var(--warn)" }}>
          <div className="eyebrow mb-1" style={{ color: "var(--warn)" }}>Cancel armed — operator window open</div>
          <p className="text-sm">
            The escrow does not move yet. The operator can still run the due review and be paid
            for delivered work; once the window elapses, anyone can execute the cancel.
          </p>
          <button onClick={() => run("finalize-cancel", {
            label: "Finalize the cancel",
            detail: m.title,
            effect: `${genFromWei(m.escrow_remaining_wei)} GEN returned to the client.`,
            send: () => finalizeCancel(client, m.mandate_id),
            settled: mandateLeft("CANCEL_PENDING"),
          })} disabled={!!busy} className="btn-danger mt-3 btn">
            {busy === "finalize-cancel" ? "Executing…" : `Finalize cancel · return ${genFromWei(m.escrow_remaining_wei)} GEN to client`}
          </button>
        </div>
      )}

      {/* client cancel */}
      {isClient && (m.status === "PROPOSED" || m.status === "ACTIVE" || m.status === "CONSTRAINED") && (
        <div className="flex items-center gap-3 mt-4">
          <button onClick={() => run("cancel", {
            label: "Cancel the mandate",
            detail: m.title,
            effect: m.status === "PROPOSED"
              ? `${genFromWei(m.escrow_remaining_wei)} GEN reclaimed — nothing was at stake.`
              : "A cancel window is now armed; the operator can still claim earned work.",
            send: () => cancelMandate(client, m.mandate_id),
            settled: mandateLeft(m.status),
          })} disabled={!!busy} className="btn-link" style={{ color: "var(--revoke)" }}>
            {busy === "cancel" ? "Cancelling…" : m.status === "PROPOSED"
              ? `Cancel mandate · reclaim ${genFromWei(m.escrow_remaining_wei)} GEN`
              : "Cancel mandate · arms a window first"}
          </button>
          <span className="mono text-[0.6rem] muted">
            {m.status === "PROPOSED"
              ? "Nothing was at stake — instant refund."
              : "The operator keeps every earned window and can still claim the one in progress."}
          </span>
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
