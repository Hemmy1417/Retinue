"use client";

import Link from "next/link";
import { RULING_META, STATUS_META, TEMPLATE_META } from "@/lib/config";
import { genFromWei, shortAddr, type Mandate, type Review } from "@/lib/retinue";

export function RulingStamp({ ruling }: { ruling: string }) {
  const m = RULING_META[ruling] ?? { label: ruling, tone: "muted" };
  return <span className={`stamp stamp-${m.tone}`}>{m.label}</span>;
}

export function StatusChip({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, tone: "muted" };
  return <span className={`stamp stamp-${m.tone}`}>{m.label}</span>;
}

/** One cell per window: paid, up-next, or remaining. */
export function WindowMeter({ m }: { m: Mandate }) {
  const cells = [];
  for (let i = 0; i < m.windows_total; i++) {
    const cls = i < m.windows_done ? "cell-paid"
      : i === m.windows_done && (m.status === "ACTIVE" || m.status === "CONSTRAINED") ? "cell-next" : "";
    cells.push(<span key={i} className={cls} />);
  }
  return <div className="meter">{cells}</div>;
}

export function MandateCard({ m }: { m: Mandate }) {
  const tmpl = TEMPLATE_META[m.template] ?? { label: m.template };
  return (
    <Link href={`/m/${m.mandate_id}`} className="panel panel-hover p-4 flex flex-col gap-3 fade-in">
      <div className="flex items-center justify-between gap-2">
        <span className="chip">{tmpl.label}</span>
        <StatusChip status={m.status} />
      </div>
      <p className="body-strong text-[0.95rem] leading-snug" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 40 }}>
        {m.title}
      </p>
      <WindowMeter m={m} />
      <div className="flex items-center justify-between mono text-[0.62rem] muted">
        <span>{m.windows_done}/{m.windows_total} windows · {genFromWei(m.rate_wei)} GEN/window</span>
        <span>{shortAddr(m.operator)}</span>
      </div>
    </Link>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-3.5">
      <div className="eyebrow mb-1">{label}</div>
      <div className="display text-lg tabular">{value}</div>
      {hint && <div className="mono text-[0.6rem] muted mt-0.5">{hint}</div>}
    </div>
  );
}

/** A full review entry — the inspection log line. */
export function ReviewEntry({ rv }: { rv: Review }) {
  return (
    <div className="panel p-4 fade-in">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="mono text-[0.62rem] muted">Window {rv.window_index + 1} · {rv.review_id}</span>
        <RulingStamp ruling={rv.ruling} />
        {rv.appealed && (
          <span className={`stamp ${rv.appeal_outcome === "FLIPPED" ? "stamp-release" : "stamp-muted"}`}>
            {rv.appeal_outcome === "FLIPPED" ? "Flipped on appeal" : "Appeal upheld"}
          </span>
        )}
        {rv.injection && <span className="stamp stamp-constrain">Injection attempt</span>}
        <span className="mono text-[0.62rem] muted ml-auto">conf {rv.confidence}</span>
      </div>
      <div className="flex gap-2 flex-wrap mono text-[0.62rem] muted mb-2">
        <span className="chip">compliance {rv.compliance}</span>
        <span className="chip">presence {rv.presence}</span>
        <span className="chip">prohibited {rv.prohibited}</span>
        {rv.disclosure !== "N_A" && <span className="chip">disclosure {rv.disclosure}</span>}
        {BigInt(rv.paid_wei || "0") > BigInt(0) && <span className="chip" style={{ color: "var(--release)" }}>paid {genFromWei(rv.paid_wei)} GEN</span>}
      </div>
      <p className="text-sm leading-relaxed">{rv.summary}</p>
      {rv.violations.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {rv.violations.map((v, i) => (
            <li key={i} className="mono text-[0.68rem]" style={{ color: "var(--constrain)" }}>▸ {v}</li>
          ))}
        </ul>
      )}
      {rv.appealed && rv.appeal_ruling && (
        <div className="inset p-3 mt-3">
          <div className="eyebrow mb-1">Second round · appeal</div>
          <p className="text-[0.82rem] leading-relaxed">{rv.appeal_ruling.summary}</p>
        </div>
      )}
    </div>
  );
}
