// Typed wrapper around the Retinue intelligent contract.
// Reads return JSON strings from the contract; writes wait for ACCEPTED and
// surface clean gl.vm.UserError reverts (message rides in a rollback
// "payload" field with EMPTY stderr — walk the receipt or rejections vanish).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

import { createClient } from "genlayer-js";
import { CHAIN, CONTRACT_ADDRESS } from "./config";

// ── types ────────────────────────────────────────────────────────────────────

export type MandateStatus =
  | "PROPOSED" | "ACTIVE" | "CONSTRAINED"
  | "REVOKE_PENDING" | "REVOKED" | "COMPLETED" | "CANCEL_PENDING" | "CANCELLED";

export type Mandate = {
  mandate_id: string;
  seq: number;
  client: string;
  operator: string;
  title: string;
  template: string;
  brief: string;
  surfaces: string[];
  windows_total: number;
  windows_done: number;
  rate_wei: string;
  escrow_remaining_wei: string;
  strikes: number;
  constraint_note: string;
  window_note?: string;
  offer_id?: string;
  status: MandateStatus;
  revoke_armed_at: number;
  review_ids: string[];
  // v0.3
  operator_bond_wei: string;
  window_interval_seconds: number;
  window_deadline_epoch: number;
  forfeits_count: number;
};

export type OperatorProfile = {
  operator: string;
  handle: string;
  bio: string;
  specialties: string[];
  rate_hint_wei: string;
  portfolio: string[];
  record?: OperatorRecord;
};

export type OfferStatus = "OPEN" | "AGREED" | "FUNDED" | "WITHDRAWN";

export type Offer = {
  offer_id: string;
  seq: number;
  client: string;
  operator: string;
  title: string;
  template: string;
  brief: string;
  surfaces: string[];
  windows: number;
  rate_wei: string;
  rounds: number;
  turn: "client" | "operator";
  last_editor: "client" | "operator";
  note: string;
  status: OfferStatus;
  accepted_by?: string;
  mandate_id?: string;
};

export type AppealRuling = {
  ruling: string;
  confidence: number;
  violations: string[];
  summary: string;
};

export type Review = {
  review_id: string;
  mandate_id: string;
  window_index: number;
  triggered_by: string;
  ruling: string;
  original_ruling: string;
  compliance: string;
  presence: string;
  prohibited: string;
  injection: boolean;
  disclosure: string;
  confidence: number;
  violations: string[];
  summary: string;
  evidence_digest?: string;
  evidence_hash?: string;
  paid_wei: string;
  appealed: boolean;
  appeal_note: string;
  appeal_outcome: "" | "FLIPPED" | "UPHELD";
  appeal_bond_wei: string;
  appeal_ruling: AppealRuling | null;
};

export type OperatorRecord = {
  operator: string;
  windows_served: number;
  released: number;
  warns: number;
  constrains: number;
  revokes: number;
  completed: number;
  appeals_won: number;
  appeals_lost: number;
  forfeits?: number;
  reputation?: number;   // v0.4 — derived 0-100 standing
};

export type Stats = {
  total_mandates: number;
  total_reviews: number;
  total_operators: number;
  total_offers: number;
  escrowed_wei: string;
  paid_out_wei: string;
  refunded_wei: string;
  min_retainer_wei: string;
  windows_range: [number, number];
  appeal_bond_bps: number;
  min_appeal_bond_wei: string;
  appeal_window_actions: number;
  cancel_window_actions: number;
  strikes_to_escalate: number;
  // v0.3
  bonds_held_wei: string;
  operator_bond_bps: number;
  min_operator_bond_wei: string;
  window_interval_hours_range: [number, number];
};

// ── gen helpers ──────────────────────────────────────────────────────────────

const WEI = BigInt(10) ** BigInt(18);

export function genFromWei(wei: string | bigint | number): string {
  let w: bigint;
  try { w = typeof wei === "bigint" ? wei : BigInt(String(wei).split(".")[0] || "0"); }
  catch { return "0"; }
  const neg = w < BigInt(0);
  if (neg) w = -w;
  const whole = w / WEI;
  const rem = (w % WEI).toString().padStart(18, "0").replace(/0+$/, "").slice(0, 4);
  return `${neg ? "−" : ""}${whole}${rem ? "." + rem : ""}`;
}

export function genToWei(gen: string): bigint {
  const [w, f = ""] = String(gen).trim().split(".");
  return BigInt(w || "0") * WEI + BigInt((f + "0".repeat(18)).slice(0, 18));
}

export function shortAddr(a: string): string {
  return a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function appealBondWei(rateWei: string, bps = 100, minWei = BigInt(10) ** BigInt(16)): bigint {
  const pct = (BigInt(rateWei || "0") * BigInt(bps)) / BigInt(10000);
  return pct > minWei ? pct : minWei;
}

// ── reads ────────────────────────────────────────────────────────────────────

function isTransient(msg: string): boolean {
  const l = msg.toLowerCase();
  return l.includes("failed to fetch") || l.includes("rate") || l.includes("network")
    || l.includes("timeout") || l.includes("busy") || l.includes("503") || l.includes("502");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function read(method: string, args: (string | number)[] = []): Promise<string> {
  const client = createClient({ chain: CHAIN });
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return (await client.readContract({
        address: CONTRACT_ADDRESS, functionName: method, args,
      })) as string;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isTransient(msg) && attempt < 4) { await sleep(1200 * attempt); continue; }
      throw e;
    }
  }
  return "";
}

export async function getMandate(id: string): Promise<Mandate | null> {
  const raw = await read("get_mandate", [id]);
  return raw ? JSON.parse(raw) : null;
}

export async function getReview(id: string): Promise<Review | null> {
  const raw = await read("get_review", [id]);
  return raw ? JSON.parse(raw) : null;
}

export async function getReviewsFor(mandateId: string): Promise<Review[]> {
  const raw = await read("get_reviews_for", [mandateId]);
  return raw ? JSON.parse(raw) : [];
}

export async function getMandatesForClient(address: string): Promise<Mandate[]> {
  const raw = await read("get_mandates_for_client", [address]);
  return raw ? JSON.parse(raw) : [];
}

export async function getMandatesForOperator(address: string): Promise<Mandate[]> {
  const raw = await read("get_mandates_for_operator", [address]);
  return raw ? JSON.parse(raw) : [];
}

export async function getOperatorRecord(address: string): Promise<OperatorRecord | null> {
  const raw = await read("get_operator_record", [address]);
  return raw ? JSON.parse(raw) : null;
}

export async function getRegistry(n = 50): Promise<Mandate[]> {
  const raw = await read("get_registry", [String(n)]);
  return raw ? JSON.parse(raw) : [];
}

export async function getStats(): Promise<Stats | null> {
  const raw = await read("get_stats", []);
  return raw ? JSON.parse(raw) : null;
}

export async function getBench(n = 50): Promise<OperatorProfile[]> {
  const raw = await read("get_bench", [String(n)]);
  return raw ? JSON.parse(raw) : [];
}

export type BenchRank = {
  operator: string;
  handle: string;
  reputation: number;
  specialties: string[];
  rate_hint_wei: string;
};

// The hiring directory ranked by on-chain reputation (maintained top-K, no scan).
export async function getBenchRanked(n = 50): Promise<BenchRank[]> {
  const raw = await read("get_bench_ranked", [String(n)]);
  return raw ? JSON.parse(raw) : [];
}

export type AcceptQuote = {
  base_bond_wei: string;
  discount_bps: number;
  required_bond_wei: string;
  operator_reputation: number;
};

// The exact performance bond the operator must post to accept — the base 20%
// less their reputation discount. Read this before accept, send required_bond_wei.
export async function getAcceptQuote(mandateId: string): Promise<AcceptQuote | null> {
  const raw = await read("quote_accept", [mandateId]);
  return raw ? JSON.parse(raw) : null;
}

export async function getOperatorProfile(address: string): Promise<OperatorProfile | null> {
  const raw = await read("get_operator_profile", [address]);
  return raw ? JSON.parse(raw) : null;
}

export async function getOffer(id: string): Promise<Offer | null> {
  const raw = await read("get_offer", [id]);
  return raw ? JSON.parse(raw) : null;
}

export async function getOffersFor(address: string): Promise<Offer[]> {
  const raw = await read("get_offers_for", [address]);
  return raw ? JSON.parse(raw) : [];
}

// ── writes ───────────────────────────────────────────────────────────────────

/**
 * Broadcast only — returns as soon as there is a hash.
 *
 * Split from the receipt wait so the UI can tell "your wallet is asking you to sign"
 * apart from "the network is deciding". Collapsed, every action is one unexplained
 * 40-second freeze.
 */
export async function submitWrite(
  client: Client, method: string, args: unknown[], value: bigint = BigInt(0),
): Promise<string> {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS, functionName: method, args, value,
  });
  return String(hash);
}

/** Wait for consensus, surface contract reverts, and return the parsed payload. */
export async function awaitReceipt<T>(client: Client, hash: string, method = ""): Promise<T | null> {
  const receipt = await client.waitForTransactionReceipt({
    hash, status: "ACCEPTED", interval: 5000, retries: 180,
  });
  const status = String(receipt?.status ?? "").toUpperCase();
  if (status.includes("UNDETERMINED") || status.includes("CANCELED")) {
    throw new Error("Validators could not reach consensus — try again");
  }

  const lr = receipt?.consensus_data?.leader_receipt;
  const r = Array.isArray(lr) ? lr[0] : lr;
  if (r?.execution_result === "ERROR") {
    const stderr: string = r?.genvm_result?.stderr ?? "";
    const userErr = stderr.match(/UserError: (.+)/)?.[1];
    if (userErr) throw new Error(userErr);
    const payloads: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walk = (o: any, d = 0) => {
      if (!o || d > 8) return;
      if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1)); return; }
      if (typeof o === "object") {
        if (typeof o.payload === "string" && o.payload && o.payload !== "exit_code 1") payloads.push(o.payload);
        Object.values(o).forEach((v) => walk(v, d + 1));
      }
    };
    walk(receipt);
    const msg = payloads.sort((a, b) => b.length - a.length)[0] || "";
    console.error("[Retinue] contract execution error:", { method, payloads, stderr });
    throw new Error((msg || "Contract execution error — see console").slice(0, 240));
  }

  const payload = r?.result?.payload?.readable ?? r?.result?.readable ?? null;
  if (typeof payload === "string") {
    try { return JSON.parse(JSON.parse(payload)) as T; } catch { /* caller re-reads */ }
  }
  return null;
}

/** Submit and wait, for callers that don't need the phases separated. */
export async function writeAndWait<T>(
  client: Client, method: string, args: unknown[], value: bigint = BigInt(0),
): Promise<T | null> {
  const hash = await submitWrite(client, method, args, value);
  return awaitReceipt<T>(client, hash, method);
}

export async function retain(
  client: Client, operator: string, title: string, template: string,
  brief: string, surfaces: string[], windows: number, totalWei: bigint,
  windowIntervalHours = 0,
): Promise<string> {
  return submitWrite(client, "retain",
    [operator, title, template, brief, JSON.stringify(surfaces), windows, windowIntervalHours], totalWei);
}

// Operator consent + performance bond. bondWei must equal the required amount
// (20% of the retainer, min 0.02 GEN) — read it from the PROPOSED mandate.
export async function acceptMandate(
  client: Client, mandateId: string, bondWei: bigint,
): Promise<string> {
  return submitWrite(client, "accept_mandate", [mandateId], bondWei);
}

// Permissionless: reclaim a timed window the operator let go stale past its deadline.
export async function forfeitWindow(client: Client, mandateId: string): Promise<string> {
  return submitWrite(client, "forfeit_window", [mandateId]);
}

// The operator bond the contract will require at accept for a given mandate.
export function operatorBondRequired(m: { rate_wei: string; windows_total: number }): bigint {
  const exact = BigInt(m.rate_wei) * BigInt(m.windows_total);
  const pct = (exact * BigInt(2000)) / BigInt(10000);
  const floor = BigInt("20000000000000000"); // 0.02 GEN
  return pct > floor ? pct : floor;
}

export async function reviewWindow(client: Client, mandateId: string): Promise<string> {
  return submitWrite(client, "review_window", [mandateId]);
}

export async function appealRuling(
  client: Client, reviewId: string, instructions: string, bondWei: bigint,
): Promise<string> {
  return submitWrite(client, "appeal_ruling", [reviewId, instructions], bondWei);
}

export async function finalizeRevoke(client: Client, mandateId: string): Promise<string> {
  return submitWrite(client, "finalize_revoke", [mandateId]);
}

export async function cancelMandate(client: Client, mandateId: string): Promise<string> {
  return submitWrite(client, "cancel_mandate", [mandateId]);
}

export async function finalizeCancel(client: Client, mandateId: string): Promise<string> {
  return submitWrite(client, "finalize_cancel", [mandateId]);
}

// ── v0.2: the Bench, offers, window notes ────────────────────────────────────

export async function registerOperator(
  client: Client, handle: string, bio: string,
  specialties: string[], rateHintWei: bigint, portfolio: string[],
): Promise<string> {
  return submitWrite(client, "register_operator",
    [handle, bio, JSON.stringify(specialties), rateHintWei.toString(), JSON.stringify(portfolio)]);
}

export async function proposeOffer(
  client: Client, operator: string, title: string, template: string,
  brief: string, surfaces: string[], windows: number, rateWei: bigint, note: string,
): Promise<string> {
  return submitWrite(client, "propose_offer",
    [operator, title, template, brief, JSON.stringify(surfaces), windows, rateWei.toString(), note]);
}

export async function counterOffer(
  client: Client, offerId: string, brief: string, surfaces: string[],
  windows: number, rateWei: bigint, note: string,
): Promise<string> {
  return submitWrite(client, "counter_offer",
    [offerId, brief, JSON.stringify(surfaces), windows, rateWei.toString(), note]);
}

export async function acceptOffer(client: Client, offerId: string): Promise<string> {
  return submitWrite(client, "accept_offer", [offerId]);
}

export async function withdrawOffer(client: Client, offerId: string): Promise<string> {
  return submitWrite(client, "withdraw_offer", [offerId]);
}

export async function retainFromOffer(client: Client, offerId: string, totalWei: bigint): Promise<string> {
  return submitWrite(client, "retain_from_offer", [offerId], totalWei);
}

export async function postWindowNote(client: Client, mandateId: string, note: string) {
  return submitWrite(client, "post_window_note", [mandateId, note]);
}


/**
 * Contract ids are sequential and zero-based (`m_0`, `rv_3`, `b-2`). Exact, and they
 * must stay quotable against the chain — but as a page title they read like debug
 * output. Headings get a 1-based, zero-padded docket number; the raw id survives as a
 * small muted reference. Headline for humans, reference for auditors.
 */
export function docketNo(id: string): string {
  const n = Number(String(id).split(/[-_]/).pop());
  return Number.isFinite(n) ? String(n + 1).padStart(4, "0") : String(id);
}

/** "lead_submitted" -> "Lead submitted" — stored slugs are not display strings. */
export function humanize(s: string): string {
  const t = String(s || "").replace(/[_-]+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}
