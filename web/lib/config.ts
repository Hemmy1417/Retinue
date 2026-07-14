// Retinue frontend config.
import { studionet, testnetBradbury } from "genlayer-js/chains";

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "studionet").toLowerCase();
export const IS_BRADBURY = NETWORK === "bradbury";
export const CHAIN = IS_BRADBURY ? testnetBradbury : studionet;
export const CHAIN_HEX = ("0x" + CHAIN.id.toString(16)) as `0x${string}`;
export const CHAIN_RPC = CHAIN.rpcUrls.default.http[0];
export const CHAIN_NAME = CHAIN.name;
export const GAS_SPONSORED = !IS_BRADBURY;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x85A11dD78Ce6cE5516bD4e5E797227ce240be719") as `0x${string}`;

export const EXPLORER_URL = (
  process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-studio.genlayer.com"
).replace(/\/$/, "");

export function explorerTxUrl(hash: string): string {
  if (!EXPLORER_URL || !hash) return "";
  return `${EXPLORER_URL}/tx/${hash}`;
}

export const TEMPLATES = ["retainer", "sponsorship", "takeover"] as const;
export type Template = (typeof TEMPLATES)[number];

export const TEMPLATE_META: Record<string, { label: string; hint: string }> = {
  retainer:    { label: "Retainer",    hint: "Ongoing stewardship of an account or blog — voice, topics, cadence." },
  sponsorship: { label: "Sponsorship", hint: "A placement must exist, carry its disclosure, and stay live." },
  takeover:    { label: "Takeover",    hint: "A bounded campaign judged window by window until it ends." },
};

// Ruling ladder — mirrors the contract's RANK map.
export const RULING_META: Record<string, { label: string; tone: string; blurb: string }> = {
  RELEASE:   { label: "Release",   tone: "release",   blurb: "Window paid in full" },
  WARN:      { label: "Warn",      tone: "warn",      blurb: "Paid, strike on record" },
  CONSTRAIN: { label: "Constrain", tone: "constrain", blurb: "Paid, probation active" },
  REVOKE:    { label: "Revoke",    tone: "revoke",    blurb: "Armed — appeal window open" },
};

export const STATUS_META: Record<string, { label: string; tone: string }> = {
  PROPOSED:       { label: "Awaiting operator", tone: "muted" },
  ACTIVE:         { label: "Under mandate",     tone: "release" },
  CONSTRAINED:    { label: "On probation",      tone: "constrain" },
  REVOKE_PENDING: { label: "Revoke armed",      tone: "revoke" },
  REVOKED:        { label: "Revoked",           tone: "revoke" },
  COMPLETED:      { label: "Completed",         tone: "release" },
  CANCELLED:      { label: "Cancelled",         tone: "muted" },
};

export const MIN_WINDOWS = 2;
export const MAX_WINDOWS = 12;
export const MIN_RETAINER_GEN = 0.1;
export const MAX_SURFACES = 3;
