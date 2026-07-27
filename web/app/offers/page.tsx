"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { useTx } from "@/lib/tx";
import {
  getOffersFor, proposeOffer, counterOffer, acceptOffer, withdrawOffer, retainFromOffer,
  genFromWei, genToWei, shortAddr, awaitReceipt, type Offer, docketNo} from "@/lib/retinue";

const STATUS_COLOR: Record<string, string> = {
  OPEN: "var(--warn)", AGREED: "var(--release)", FUNDED: "var(--signal)", WITHDRAWN: "var(--muted)",
};

function OffersInner() {
  const qs = useSearchParams();
  const { address, client, connect } = useWallet();
  const tx = useTx();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [showForm, setShowForm] = useState(!!qs.get("to"));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  // propose form
  const [op, setOp] = useState(qs.get("to") || "");
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState("retainer");
  const [brief, setBrief] = useState("");
  const [surfaces, setSurfaces] = useState("");
  const [windows, setWindows] = useState("4");
  const [rate, setRate] = useState("0.1");
  const [note, setNote] = useState("");

  // counter form (per offer)
  const [counterFor, setCounterFor] = useState("");
  const [cRate, setCRate] = useState("");
  const [cNote, setCNote] = useState("");

  const load = useCallback(() => {
    if (address) getOffersFor(address).then(setOffers).catch(() => {});
  }, [address]);
  useEffect(() => { load(); }, [load]);

  /**
   * `settled` polls a contract view until the change is readable — a GenLayer receipt
   * says ACCEPTED, not "views updated", so refreshing on the receipt alone re-renders
   * the same pre-transaction state and the table looks untouched.
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
    setErr(""); setBusy(tag);
    try {
      await tx.run({
        label: opts.label,
        detail: opts.detail,
        effect: opts.effect,
        send: opts.send,
        confirm: (h) => awaitReceipt(client, h),
        settled: opts.settled,
        onSettled: load,
      });
    } catch {
      /* the toast owns the error */
    } finally {
      setBusy("");
    }
  }

  /** Poll until this offer's status actually moves off what it was. */
  const offerLeft = (id: string, from: string) => async () => {
    const all = await getOffersFor(address).catch(() => []);
    const o = all.find((x) => x.offer_id === id);
    return !!o && o.status !== from;
  };

  if (!address) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <h1 className="display text-2xl">The table</h1>
        <p className="text-sm muted mt-3">Connect to negotiate terms before a wei moves.</p>
        <button onClick={() => connect().catch(() => {})} className="btn btn-signal mt-5">Connect</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-6 py-8">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-2">
        <div>
          <p className="eyebrow mb-2">Layer 2 · negotiation — unfunded term sheets, strict turns</p>
          <h1 className="display" style={{ fontSize: "clamp(24px,3.6vw,38px)" }}>Offers</h1>
        </div>
        <button className="btn btn-signal" onClick={() => setShowForm((s) => !s)}>Propose terms</button>
      </div>
      <p className="text-sm muted mb-6" style={{ maxWidth: "64ch" }}>
        Nothing here is funded and nothing here judges anyone — it&apos;s terms on a table.
        Whoever&apos;s turn it is may counter or accept; four rounds and the table closes.
        An accepted offer funds into a live mandate with no further consent step: the
        negotiation was the consent.
      </p>

      {showForm && (
        <div className="panel p-5 mb-6" style={{ borderTop: "3px solid var(--signal)" }}>
          <div className="eyebrow mb-3" style={{ color: "var(--signal)" }}>New term sheet (you are the client)</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="spec-key block mb-1">Operator wallet</label>
              <input className="input w-full mono text-xs" value={op} onChange={(e) => setOp(e.target.value)} placeholder="0x…" />
            </div>
            <div>
              <label className="spec-key block mb-1">Title</label>
              <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Example brand blog" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <label className="spec-key block mb-1">Template</label>
              <select className="input w-full" value={template} onChange={(e) => setTemplate(e.target.value)}>
                <option value="retainer">retainer</option>
                <option value="sponsorship">sponsorship</option>
                <option value="takeover">takeover</option>
              </select>
            </div>
            <div>
              <label className="spec-key block mb-1">Windows (2–12)</label>
              <input className="input w-full mono" inputMode="numeric" value={windows} onChange={(e) => setWindows(e.target.value)} />
            </div>
            <div>
              <label className="spec-key block mb-1">Rate (GEN / window)</label>
              <input className="input w-full mono" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          </div>
          <label className="spec-key block mb-1 mt-3">Mandate brief (the panel rules on these words — min 80 chars)</label>
          <textarea className="input w-full text-sm" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)}
            placeholder="Voice, topics, cadence, prohibitions, disclosure rules…" />
          <label className="spec-key block mb-1 mt-3">Pinned surfaces (one URL per line, 1–3 — frozen at funding)</label>
          <textarea className="input w-full mono text-xs" rows={2} value={surfaces} onChange={(e) => setSurfaces(e.target.value)} placeholder="https://…" />
          <label className="spec-key block mb-1 mt-3">Note to the operator (optional)</label>
          <input className="input w-full text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opening terms — happy to talk rate." />
          <button
            className="btn btn-signal mt-4"
            disabled={busy === "propose" || brief.trim().length < 80}
            onClick={() => { const before = offers.length; return run("propose", {
              label: "Send the offer",
              detail: `${title.trim()} · ${rate || "0"} GEN per window`,
              effect: "Offer sent — the operator moves next.",
              send: () => proposeOffer(
              client, op.trim(), title.trim(), template, brief.trim(),
              surfaces.split("\n").map((u) => u.trim()).filter(Boolean).slice(0, 3),
              Number(windows), genToWei(rate || "0"), note.trim(),
            ),
              settled: async () => (await getOffersFor(address).catch(() => [])).length > before,
            }); }}
          >
            {busy === "propose" ? "Placing on the table…" : `Propose · total ${(Number(windows) || 0) * (Number(rate) || 0)} GEN unfunded`}
          </button>
        </div>
      )}

      {offers.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm muted mb-1">No terms on your table.</p>
          <p className="mono text-[0.66rem] muted">Find an operator on the <Link href="/bench" className="link">bench</Link> and propose.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {offers.map((o) => {
            const meClient = o.client.toLowerCase() === address.toLowerCase();
            const myRole = meClient ? "client" : "operator";
            const myTurn = o.status === "OPEN" && o.turn === myRole;
            const total = BigInt(o.rate_wei) * BigInt(o.windows);
            return (
              <div key={o.offer_id} className="panel p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div style={{ minWidth: 0 }}>
                    <p className="body-strong text-sm">{o.title} <span className="mono text-[0.62rem] muted">· Offer {docketNo(o.offer_id)} · {o.template}</span></p>
                    <p className="mono text-[0.64rem] muted mt-0.5">
                      {meClient ? <>you → <Link href={`/u/${o.operator}`} className="link">{shortAddr(o.operator)}</Link></> : <>{shortAddr(o.client)} → you</>}
                      {" · "}{o.windows} windows × {genFromWei(o.rate_wei)} GEN = {genFromWei(total.toString())} GEN
                      {" · "}round {o.rounds}/4
                    </p>
                  </div>
                  <span className="mono text-[0.6rem]" style={{ color: STATUS_COLOR[o.status], border: `1.5px solid ${STATUS_COLOR[o.status]}`, borderRadius: 4, padding: "0.16rem 0.45rem", letterSpacing: "0.1em" }}>
                    {o.status}{o.status === "OPEN" && ` · ${o.turn === myRole ? "your turn" : `${o.turn}'s turn`}`}
                  </span>
                </div>
                {o.note && <p className="text-[0.78rem] mt-2 inset p-2.5">“{o.note}” <span className="mono text-[0.6rem] muted">— {o.last_editor}</span></p>}

                {/* actions */}
                <div className="flex gap-2 flex-wrap mt-3">
                  {myTurn && (
                    <>
                      <button className="btn btn-signal" style={{ fontSize: "0.76rem", padding: "0.4rem 0.8rem" }}
                        disabled={!!busy}
                        onClick={() => run("accept", {
                          label: "Accept the terms",
                          detail: `Offer ${docketNo(o.offer_id)} · ${o.title}`,
                          effect: "Agreed — the client can now fund it into a mandate.",
                          send: () => acceptOffer(client, o.offer_id),
                          settled: offerLeft(o.offer_id, o.status),
                        })}>
                        {busy === "accept" ? "Signing…" : `Accept ${o.last_editor}'s terms`}
                      </button>
                      <button className="btn-ghost" style={{ fontSize: "0.76rem", padding: "0.4rem 0.8rem" }}
                        onClick={() => { setCounterFor(counterFor === o.offer_id ? "" : o.offer_id); setCRate(genFromWei(o.rate_wei)); }}>
                        Counter
                      </button>
                    </>
                  )}
                  {o.status === "AGREED" && meClient && (
                    <button className="btn btn-signal" style={{ fontSize: "0.76rem", padding: "0.4rem 0.8rem" }}
                      disabled={!!busy}
                      onClick={() => run("fund", {
                        label: "Fund the mandate",
                        detail: `${o.title} · ${genFromWei(total.toString())} GEN escrowed`,
                        effect: "Funded — the mandate is open and awaiting operator acceptance.",
                        send: () => retainFromOffer(client, o.offer_id, total),
                        settled: offerLeft(o.offer_id, o.status),
                      })}>
                      {busy === "fund" ? "Escrowing…" : `Fund · ${genFromWei(total.toString())} GEN → live mandate`}
                    </button>
                  )}
                  {o.status === "AGREED" && !meClient && (
                    <span className="mono text-[0.66rem] muted self-center">agreed — waiting on the client&apos;s escrow</span>
                  )}
                  {(o.status === "OPEN" || o.status === "AGREED") && (
                    <button className="btn-ghost" style={{ fontSize: "0.76rem", padding: "0.4rem 0.8rem" }}
                      disabled={!!busy}
                      onClick={() => run("withdraw", {
                        label: "Withdraw the offer",
                        detail: `Offer ${docketNo(o.offer_id)} · ${o.title}`,
                        effect: "Withdrawn — the table is clear.",
                        send: () => withdrawOffer(client, o.offer_id),
                        settled: offerLeft(o.offer_id, o.status),
                      })}>
                      Walk away
                    </button>
                  )}
                  {o.status === "FUNDED" && o.mandate_id && (
                    <Link href={`/m/${o.mandate_id}`} className="btn btn-signal" style={{ fontSize: "0.76rem", padding: "0.4rem 0.8rem" }}>
                      Open the mandate →
                    </Link>
                  )}
                </div>

                {/* counter form */}
                {counterFor === o.offer_id && myTurn && (
                  <div className="inset p-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="spec-key block mb-1">Your rate (GEN / window)</label>
                        <input className="input w-full mono" inputMode="decimal" value={cRate} onChange={(e) => setCRate(e.target.value)} />
                      </div>
                      <div>
                        <label className="spec-key block mb-1">Note</label>
                        <input className="input w-full text-sm" value={cNote} onChange={(e) => setCNote(e.target.value)} placeholder="My rate is…" />
                      </div>
                    </div>
                    <button className="btn btn-signal mt-3" style={{ fontSize: "0.76rem" }}
                      disabled={!!busy}
                      onClick={() => { const rounds = o.rounds; return run("counter", {
                        label: "Send a counter",
                        detail: `Offer ${docketNo(o.offer_id)} · ${cRate || "0"} GEN per window`,
                        effect: "Countered — it is now the other side's move.",
                        send: () => counterOffer(
                        client, o.offer_id, o.brief, o.surfaces, o.windows, genToWei(cRate || "0"), cNote.trim(),
                      ),
                        settled: async () => {
                          const all = await getOffersFor(address).catch(() => []);
                          const x = all.find((y) => y.offer_id === o.offer_id);
                          return !!x && x.rounds > rounds;
                        },
                      }); }}>
                      {busy === "counter" ? "Countering…" : "Send counter"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {err && <p className="mono text-xs mt-4" style={{ color: "var(--revoke)" }}>{err}</p>}
    </div>
  );
}

export default function OffersPage() {
  return <Suspense fallback={null}><OffersInner /></Suspense>;
}
