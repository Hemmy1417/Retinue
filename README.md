<p align="center">
  <img src="https://raw.githubusercontent.com/Hemmy1417/Retinue/master/web/app/icon.svg" alt="Retinue" width="140" />
</p>

# Retinue - The Retainer That Audits the Work Itself

**Content-operator mandates supervised by validator consensus on GenLayer - a full Internet Court
instance, one vertical.**

You hand your public voice to an agency, a ghostwriter, or an AI posting agent - and the mandate
lives in a PDF nobody can enforce. Retinue escrows the retainer and puts a GenLayer validator panel
on the account: at every review window the panel **fetches the live pages itself** and rules the
actual public output against the mandate's own words. No screenshots, no status reports, no
self-supplied evidence - the deliverable is the page.

Live app: **https://retinue-omega.vercel.app**

## What it is

- **The evidence is never donated** - validators fetch the pinned public surfaces in consensus;
  the party under review supplies nothing.
- **A ruling ladder with money effects** - RELEASE / WARN / CONSTRAIN / REVOKE, each enforced by
  the contract, with deterministic floors the panel cannot lower.
- **Due process both directions** - consent gates every mandate, appeals are bonded and can never
  make things worse, and no adverse money path executes in the same breath it is decided.
- **The Bench** - self-owned operator registration and a public directory where every card's grade
  is written by panel rulings, not self-description.
- **No owner, no admin keys, no pooled funds** - the contract takes no constructor arguments and
  each mandate is its own escrow.

## How it works

### For clients
1. Discover an operator on the Bench - the record shown is panel-written.
2. Negotiate an unfunded offer (strict turn-taking, round-capped) or retain directly.
3. Fund the mandate: brief + pinned surfaces + 2-12 review windows, frozen at funding.
4. Run `review_window` when a window is due - the panel fetches the live surfaces and rules.
5. Cancel any time - but through a two-step window the operator can still earn out.

### For operators
1. Register on the Bench: handle, bio, specialties - identity you own.
2. Accept or counter offers; nothing judges you until you consent.
3. Do the work in public - the pinned surfaces are the deliverable.
4. Optionally post a per-window note: advocacy that points the panel at the work, never evidence.
5. Contest one adverse ruling with a bonded appeal and custom instructions; a strictly better
   ruling flips it and unwinds its effects.

## The ruling ladder

| Ruling | Effect |
|---|---|
| `RELEASE` | Window paid in full. |
| `WARN` | Paid, with a strike on the record; two strikes escalate the next ruling. |
| `CONSTRAIN` | Paid, probation begins - the panel writes the constraint and the next window is held to it. |
| `REVOKE` | Nothing pays and nothing drains: the revoke **arms** and waits out a bonded-appeal window before a wei moves. |

Deterministic floors, enforced in code: a prompt-injection attempt found in any fetched page,
window note, or appeal instruction floors the ruling at `CONSTRAIN`; a `WARN` on a two-strike
record escalates to `CONSTRAIN`.

## The Internet Court layers

Retinue implements every layer of the [Internet Court](https://internetcourt.org) agentic-commerce
stack for this vertical - the reputation written at layer 6 is exactly what a client hires on at
layer 1.

| # | Layer | In Retinue |
|---|---|---|
| 1 | Discovery, identity, reputation | The Bench - `register_operator` + `get_bench`; grades written by rulings (ERC-8004 registry *pattern*, natively). |
| 2 | Negotiation | Offers - unfunded term sheets, strict turn-taking, round cap; accepting the other side's terms is consent. |
| 3 | Contracts & obligations | The mandate - natural-language brief + pinned surfaces + windows, frozen at funding. |
| 4 | Payment & escrow | GEN escrow, per-window tranches, a solvency book; `retain_from_offer` funds an agreed offer at the exact total. |
| 5 | Execution | The public web itself, plus the operator's per-window note (advocacy, never evidence). |
| 6 | Verification & disputes | Standing `review_window` rulings, bonded `appeal_ruling`, armed `finalize_revoke` / `finalize_cancel`, reputation writeback. |

Honest substitutions, stated: the payment rail is GEN (not x402/MPP); bounded authority is
custody-in-escrow rather than ERC-7710 delegation - the reviewer *is* the escrow; the registry
follows the ERC-8004 pattern without claiming compliance.

## Mandate lifecycle

```text
offer: PROPOSED <-> countered -> accepted -> FUNDED        (or WITHDRAWN)
mandate: FUNDED -> ACTIVE (operator consents) -> windows ->
             RELEASE/WARN/CONSTRAIN per window (paid tranche by tranche)
             REVOKE -> REVOKE_PENDING (appeal window) -> REVOKED (refund)
             cancel -> CANCEL_PENDING (operator can still earn the due window) -> CANCELLED
```

| State | What happens |
|---|---|
| `PROPOSED` | An unfunded offer under negotiation; either side may counter or withdraw. |
| `FUNDED` | Escrowed at the exact agreed total; awaiting the operator's consent. |
| `ACTIVE` | The operator accepted - review windows may run. |
| `REVOKE_PENDING` | A REVOKE ruling armed; a bonded appeal can still flip it before funds move. |
| `REVOKED` | The appeal window passed (or an appeal was upheld) - the remaining escrow refunds. |
| `CANCEL_PENDING` | A client cancel armed; the due review can still run and pay earned work. |
| `CANCELLED` / `WITHDRAWN` | Closed; the solvency book squares to zero. |

## GenLayer consensus functions

| Function | Kind | What runs under consensus |
|---|---|---|
| `review_window` | write | The panel fetches every pinned surface live and rules the window against the mandate's own words via `gl.eq_principle.prompt_comparative`. |
| `appeal_ruling` | write, payable | A second panel re-reads the same fetched evidence with the operator's instructions as advocacy; only a strictly better ruling flips. |

An LLM-provider outage - or any malformed panel output missing a ruling - degrades a review to
`INCONCLUSIVE`: a no-op, nothing paid, no strike, the window not consumed. A broken response can
never be coerced into an adverse `REVOKE`.

## Contract

| Field | Value |
|---|---|
| Network | GenLayer Studionet |
| Chain ID | `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Explorer | `https://explorer-studio.genlayer.com` |
| Version | `v0.2.1` |
| Contract address | [`0x9574318cD06d923cf2C15dbb1beE28530EB3fd7e`](https://studio.genlayer.com/?import-contract=0x9574318cD06d923cf2C15dbb1beE28530EB3fd7e) |
| Source | `contracts/retinue.py` |
| Owner | None - no admin keys, no constructor arguments, no pooled funds |

### Write methods

| Method | Who | Payable | Notes |
|---|---|---|---|
| `register_operator(handle, bio, specialties_json, ...)` | operator | - | Self-owned Bench identity. |
| `propose_offer(operator, title, template, ...)` | client | - | Unfunded term sheet; templates: retainer, sponsorship, takeover. |
| `counter_offer(offer_id, brief, surfaces_json, ...)` | the other side | - | Strict turn-taking with a round cap. |
| `accept_offer(offer_id)` | the side to move | - | Accepting the counterparty's terms is consent. |
| `withdraw_offer(offer_id)` | either side | - | Ends a negotiation. |
| `retain_from_offer(offer_id)` | client | retainer | Funds the agreed offer at the exact total. |
| `retain(operator, title, template, ...)` | client | retainer | The direct path - 0.1 to 10 GEN, 2-12 windows, up to 3 surfaces. |
| `accept_mandate(mandate_id)` | named operator | - | The consent gate - nothing judges an operator who hasn't accepted. |
| `post_window_note(mandate_id, note)` | operator | - | Advocacy for the coming review; injection-scoped, never evidence. |
| `review_window(mandate_id)` | anyone, when due | - | Runs the panel over the live surfaces; pays or arms per the ruling. |
| `appeal_ruling(review_id, instructions)` | operator | bond | 1% of the window rate, min 0.01 GEN; can never worsen the ruling. |
| `finalize_revoke(mandate_id)` | anyone | - | Executes an armed revoke only after the appeal window. |
| `cancel_mandate(mandate_id)` | client | - | Arms the two-step cancel. |
| `finalize_cancel(mandate_id)` | anyone | - | Completes it after the window; earned work stays paid. |

### Read methods

`get_mandate`, `get_review`, `get_reviews_for`, `get_mandates_for_client`,
`get_mandates_for_operator`, `get_operator_record`, `get_operator_profile`, `get_bench`,
`get_offer`, `get_offers_for`, `get_registry`, `get_stats`

### Consensus guarantees

- **Zero party-supplied evidence** - the panel reads only what it fetched itself from the pinned
  surfaces.
- **Injection floors are code, not judgement** - an injection attempt in any fetched page, note,
  or appeal instruction deterministically floors the ruling at `CONSTRAIN`.
- **No same-breath money paths** - REVOKE and cancel both arm and wait out a window; an appeal or
  a due review can preempt them.
- **Solvency book** - `escrowed / paid_out / refunded` accounting; every closed mandate squares
  to zero.

## Verified end-to-end

Full MetaMask + CLI stress test across three mandates and all six layers (2026-07-14):

```text
bench     -> two operators registered, graded by rulings; @inkwell REVOKED ON RECORD
negotiate -> offer -> counter -> accept -> funded at the exact agreed total
review    -> panel fetched the live pinned surfaces; RELEASE paid the window tranche
injection -> a planted instruction in a fetched surface floored the ruling at CONSTRAIN
revoke    -> armed, survived the appeal window, refunded the remainder
solvency  -> the book squared exactly at every step
```

> A CLI list-decode revert was found and fixed live during the run - JSON-array arguments arrive
> as decoded lists from the CLI but strings from genlayer-js; the contract accepts both.

**44 direct-mode tests.**

## Tech stack

| Layer | Tech |
|---|---|
| Intelligent Contract | Python on GenVM (bench, offers, mandates, reviews, appeals) |
| Consensus | `gl.eq_principle.prompt_comparative` + nondet surface fetches |
| Frontend | Next.js, React, Tailwind - inspection-panel design |
| Web3 | GenLayerJS, EIP-6963 injected wallets |
| Backend | None - the contract is the source of truth |

## Repository

```text
contracts/retinue.py        The Intelligent Contract (v0.2.1, deployed)
tests/direct/               44 direct-mode tests, pytest
web/                        Next.js frontend (bench, offers, mandates, mandate room, registry)
```

## Getting started

```bash
# contract tests
python -m pytest tests/direct -q

# frontend
cd web
cp .env.example .env.local     # contract address prefilled for Studionet
npm install
npm run dev
```

## Security

- Consent gates everything - a record cannot be poisoned by a stranger naming your address
  against garbage surfaces.
- An appeal can never make things worse for the operator, so there is no chilling effect; a
  frivolous one just costs the bond.
- A client cancel on a live mandate arms rather than executes - a drive-by cancel cannot snipe an
  earned window.
- Every one-to-many index is a counter-backed flat key map - O(1) appends, no unbounded lists.
- Wallet payouts go through an empty `@gl.evm.contract_interface` proxy (`emit_transfer` at a
  plain wallet strands value).

## Design notes

- Supervising delegated authority is qualitative all the way down - but the work here is public
  web content, the one thing validators can fetch in consensus and a panel can judge.
- The appeal and cancel windows are measured in protocol actions by design — supervision stays
  deterministic with no dependency on an external time oracle - the armed two-step is the
  guarantee, and a genuine review always preempts.
- No pooled deposits by design: each mandate is its own escrow, so there is no registry, yield, or
  exit surface to get wrong.

## Disclaimer

Retinue is a hackathon project on a test network. Retainers are testnet GEN; do not use the
contract for real engagements without an audit.
