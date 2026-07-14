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
  | "REVOKE_PENDING" | "REVOKED" | "COMPLETED" | "CANCELLED";

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
  status: MandateStatus;
  revoke_armed_at: number;
  review_ids: string[];
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
};

export type Stats = {
  total_mandates: number;
  total_reviews: number;
  escrowed_wei: string;
  paid_out_wei: string;
  refunded_wei: string;
  min_retainer_wei: string;
  windows_range: [number, number];
  appeal_bond_bps: number;
  min_appeal_bond_wei: string;
  appeal_window_actions: number;
  strikes_to_escalate: number;
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

// ── writes ───────────────────────────────────────────────────────────────────

async function writeAndWait<T>(
  client: Client, method: string, args: unknown[], value: bigint = BigInt(0),
): Promise<T | null> {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS, functionName: method, args, value,
  });
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

export async function retain(
  client: Client, operator: string, title: string, template: string,
  brief: string, surfaces: string[], windows: number, totalWei: bigint,
): Promise<Mandate | null> {
  return writeAndWait<Mandate>(client, "retain",
    [operator, title, template, brief, JSON.stringify(surfaces), windows], totalWei);
}

export async function acceptMandate(client: Client, mandateId: string): Promise<Mandate | null> {
  return writeAndWait<Mandate>(client, "accept_mandate", [mandateId]);
}

export async function reviewWindow(client: Client, mandateId: string): Promise<Review | null> {
  return writeAndWait<Review>(client, "review_window", [mandateId]);
}

export async function appealRuling(
  client: Client, reviewId: string, instructions: string, bondWei: bigint,
): Promise<Review | null> {
  return writeAndWait<Review>(client, "appeal_ruling", [reviewId, instructions], bondWei);
}

export async function finalizeRevoke(client: Client, mandateId: string) {
  return writeAndWait<{ mandate_id: string; refunded_wei: string; status: string }>(
    client, "finalize_revoke", [mandateId]);
}

export async function cancelMandate(client: Client, mandateId: string) {
  return writeAndWait<{ mandate_id: string; refunded_wei: string; status: string }>(
    client, "cancel_mandate", [mandateId]);
}
