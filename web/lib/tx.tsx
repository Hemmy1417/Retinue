"use client";

/**
 * Transaction lifecycle — the thing that makes this feel like a dApp rather than a
 * form that goes quiet for a minute.
 *
 * The standard web3 pattern is: surface every phase (wallet → submitted → confirming
 * → confirmed), show the hash as soon as one exists so the user can follow it on an
 * explorer, and refetch the affected data once it lands. Wagmi apps express the last
 * step as `waitForTransactionReceipt` followed by `queryClient.invalidateQueries`.
 *
 * On GenLayer that last step is not enough, and it is exactly why this app felt dead.
 * A receipt means ACCEPTED, not "every view now returns the new value" — refetching
 * the instant the receipt lands routinely re-renders the SAME pre-transaction state,
 * so the page looks untouched even though the write succeeded. So there is one extra
 * phase here that a mainnet app does not need: RECONCILING, which polls a caller-
 * supplied predicate until the contract actually reads back changed, and only then
 * refreshes the page. If it never reconciles we say so plainly rather than pretending.
 */

import {
  createContext, useCallback, useContext, useMemo, useRef, useState,
} from "react";
import { explorerTxUrl } from "./config";

export type TxPhase =
  | "signing"       // waiting on the wallet — the user has to do something
  | "submitted"     // broadcast, we have a hash
  | "confirming"    // validators are deciding
  | "reconciling"   // accepted; waiting for the contract views to reflect it
  | "done"
  | "failed";

export type TxRecord = {
  id: string;
  label: string;        // "Settle on the verdict"
  detail?: string;      // "Submission 0002 · Northwind Payments Ltd"
  effect?: string;      // what changed, shown once it lands
  phase: TxPhase;
  hash?: string;
  error?: string;
  stale?: boolean;      // landed, but the views never caught up in time
  startedAt: number;
};

export const PHASE_COPY: Record<TxPhase, string> = {
  signing: "Confirm in your wallet",
  submitted: "Submitted to the network",
  confirming: "Validators are deciding",
  reconciling: "Writing to the record",
  done: "Confirmed",
  failed: "Failed",
};

export type RunOptions<T> = {
  label: string;
  detail?: string;
  /** Broadcast and return the hash. Should NOT wait for the receipt. */
  send: () => Promise<string>;
  /** Wait for the receipt. Throws on revert. */
  confirm?: (hash: string) => Promise<unknown>;
  /**
   * Poll until the change is visible through a contract view. Returning false just
   * means "not yet" — we keep asking until `settleTimeoutMs`. Without this we would
   * refresh into stale state, which is the whole problem.
   */
  settled?: () => Promise<boolean>;
  settleTimeoutMs?: number;
  /** Ran after reconciliation (or timeout) — refresh page data here. */
  onSettled?: () => void | Promise<void>;
  /** One line naming what changed, e.g. "Bond of 0.0098 GEN released to the business". */
  effect?: string | ((v: T) => string);
};

type TxState = {
  records: TxRecord[];
  pending: TxRecord[];
  run: <T = string>(o: RunOptions<T>) => Promise<T>;
  dismiss: (id: string) => void;
  clearFinished: () => void;
};

const Ctx = createContext<TxState | null>(null);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function TxProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<TxRecord[]>([]);
  const seq = useRef(0);

  const patch = useCallback((id: string, next: Partial<TxRecord>) => {
    setRecords((rs) => rs.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }, []);

  const dismiss = useCallback((id: string) => {
    setRecords((rs) => rs.filter((r) => r.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setRecords((rs) => rs.filter((r) => r.phase !== "done" && r.phase !== "failed"));
  }, []);

  const run = useCallback(
    async <T,>(o: RunOptions<T>): Promise<T> => {
      const id = `tx-${++seq.current}`;
      setRecords((rs) => [
        { id, label: o.label, detail: o.detail, phase: "signing" as TxPhase, startedAt: Date.now() },
        ...rs,
      ]);

      try {
        const hash = await o.send();
        patch(id, { phase: "submitted", hash });

        if (o.confirm) {
          patch(id, { phase: "confirming" });
          await o.confirm(hash);
        }

        if (o.settled) {
          patch(id, { phase: "reconciling" });
          const deadline = Date.now() + (o.settleTimeoutMs ?? 45_000);
          let ok = false;
          while (Date.now() < deadline) {
            try {
              if (await o.settled()) { ok = true; break; }
            } catch {
              /* a read that fails mid-flight is a "not yet", not a failure */
            }
            await sleep(2000);
          }
          if (!ok) patch(id, { stale: true });
        }

        await o.onSettled?.();

        const effect = typeof o.effect === "function"
          ? (o.effect as (v: T) => string)(hash as unknown as T)
          : o.effect;
        patch(id, { phase: "done", effect });

        // Successes clear themselves; failures stay until dismissed.
        setTimeout(() => dismiss(id), 10_000);
        return hash as unknown as T;
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        patch(id, { phase: "failed", error: humanizeTxError(raw) });
        throw e;
      }
    },
    [patch, dismiss],
  );

  const pending = useMemo(
    () => records.filter((r) => r.phase !== "done" && r.phase !== "failed"),
    [records],
  );

  return (
    <Ctx.Provider value={{ records, pending, run, dismiss, clearFinished }}>
      {children}
      <TxToasts />
    </Ctx.Provider>
  );
}

export function useTx(): TxState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTx must be used within TxProvider");
  return v;
}

/** Wallet and node errors are written for developers. Say what the user should do. */
export function humanizeTxError(raw: string): string {
  const l = raw.toLowerCase();
  if (l.includes("user rejected") || l.includes("user denied") || l.includes("4001")) {
    return "You declined the signature in your wallet — nothing was sent.";
  }
  if (l.includes("insufficient funds")) {
    return "Not enough GEN in this wallet to cover the amount.";
  }
  if (l.includes("consensus")) {
    return "Validators could not agree on this one. Nothing moved — try again.";
  }
  if (l.includes("chain") && l.includes("mismatch")) {
    return "Your wallet is on the wrong network. Switch to Studionet and retry.";
  }
  // Contract reverts arrive prefixed by the contract's own error class.
  const expected = raw.match(/\[EXPECTED\]\s*(.+)/);
  if (expected) return expected[1].trim();
  return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
}

// ── the visible part ─────────────────────────────────────────────────────────

function TxToasts() {
  const { records, dismiss } = useTx();
  const shown = records.slice(0, 4);
  if (shown.length === 0) return null;

  return (
    <div className="tx-toasts" role="status" aria-live="polite">
      {shown.map((r) => <TxToast key={r.id} r={r} onDismiss={() => dismiss(r.id)} />)}
    </div>
  );
}

const PHASE_ORDER: TxPhase[] = ["signing", "submitted", "confirming", "reconciling", "done"];

function TxToast({ r, onDismiss }: { r: TxRecord; onDismiss: () => void }) {
  const failed = r.phase === "failed";
  const done = r.phase === "done";
  const idx = PHASE_ORDER.indexOf(r.phase);

  return (
    <div className="tx-toast panel" data-phase={r.phase}>
      <div className="flex items-start gap-3">
        <span className={`tx-dot ${failed ? "bad" : done ? "ok" : "live"}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="display text-sm">{r.label}</span>
            <button className="tx-x" onClick={onDismiss} aria-label="Dismiss">×</button>
          </div>
          {r.detail && (
            <p className="mt-0.5 truncate text-xs" style={{ color: "var(--muted)" }}>{r.detail}</p>
          )}

          <p className="mt-1 text-xs" style={{ color: failed ? "var(--revoke)" : "var(--body)" }}>
            {failed ? r.error : done ? (r.effect ?? PHASE_COPY.done) : PHASE_COPY[r.phase]}
          </p>

          {/* Phase rail — four ticks so the wait reads as progress, not a hang. */}
          {!failed && (
            <div className="tx-rail" aria-hidden>
              {PHASE_ORDER.slice(0, 4).map((p, i) => (
                <span key={p} className={`tx-tick ${i < idx ? "past" : i === idx ? "now" : ""}`} />
              ))}
            </div>
          )}

          {r.stale && done && (
            <p className="mt-1 text-xs" style={{ color: "var(--warn)" }}>
              Landed on-chain, but the read is still catching up. Refresh in a moment.
            </p>
          )}

          {r.hash && (
            <a className="link mono mt-1 inline-block text-xs"
               href={explorerTxUrl(r.hash)} target="_blank" rel="noreferrer">
              {r.hash.slice(0, 10)}…{r.hash.slice(-6)} ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
