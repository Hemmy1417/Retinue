"""
Direct-mode tests for retinue.py — the deterministic surface without
GenLayer's AI/consensus stack. Run with:  python -m pytest tests/direct -q

The stub RUNS the panel's observe fn (so surface fetching, injection paths,
and the LLM fail-safe execute for real) and returns whatever the test primed,
so escrow math, ruling effects, strikes, the revoke window, appeal flips, and
the operator record are all proven deterministically.
"""

import importlib.util
import json
import pathlib
import sys
import types

import pytest

CONTRACT_PATH = pathlib.Path(__file__).resolve().parents[2] / "contracts" / "retinue.py"


# ── GenLayer runtime stubs ───────────────────────────────────────────────────

class _UserError(Exception):
    pass


class _VmModule:
    UserError = _UserError


class _TreeMap(dict):
    def get(self, k, default=None):
        return super().get(k, default)


class _U256(int):
    def __new__(cls, v):
        return super().__new__(cls, int(v))


class _ViewDeco:
    def __call__(self, fn): return fn


class _WriteDeco:
    payable = staticmethod(lambda fn: fn)
    def __call__(self, fn): return fn


class _Public:
    view = _ViewDeco()
    write = _WriteDeco()


class _FakeEmit:
    def __init__(self):
        self.transfers = []   # (to, value, on)

    def total_to(self, addr):
        return sum(v for (t, v, _) in self.transfers if t.lower() == addr.lower())


class _Evm:
    @staticmethod
    def contract_interface(cls):
        class _Proxy:
            def __init__(self, addr): self._addr = str(addr)
            def emit_transfer(self, value, on=None):
                _GL._emit.transfers.append((self._addr, int(value), on))
        return _Proxy


class _NondetWeb:
    pages = {}          # url -> text
    raise_all = False

    @classmethod
    def render(cls, url, mode="text"):
        if cls.raise_all or cls.pages.get(url) is _RAISE:
            raise RuntimeError("403 blocked")
        return cls.pages.get(url, f"stub page for {url}")


_RAISE = object()


class _Nondet:
    web = _NondetWeb

    @staticmethod
    def exec_prompt(prompt):
        _EqPrinciple.last_prompt = prompt
        if _EqPrinciple.llm_raise:
            raise RuntimeError("provider 503: transient upstream error")
        return _EqPrinciple.canned


class _EqPrinciple:
    canned = "{}"
    llm_raise = False
    last_prompt = ""
    last_input = ""

    @classmethod
    def prompt_comparative(cls, fn, principle):
        out = fn()
        cls.last_input = out if isinstance(out, str) else str(out)
        return out


class _GL:
    class Contract: pass
    evm = _Evm(); nondet = _Nondet; eq_principle = _EqPrinciple
    public = _Public(); vm = _VmModule
    _emit = None
    class message:
        sender_address = "0x0000000000000000000000000000000000000000"
        value = 0


class _Address(str):
    def __new__(cls, v):
        if isinstance(v, _Address):
            raise TypeError("cannot convert 'Address' object to bytes")
        return super().__new__(cls, v)


def _install():
    mod = types.ModuleType("genlayer")
    mod.gl = _GL; mod.TreeMap = _TreeMap; mod.u256 = _U256; mod.Address = _Address
    mod.__all__ = ["gl", "TreeMap", "u256", "Address"]
    sys.modules["genlayer"] = mod


def _load():
    _install()
    spec = importlib.util.spec_from_file_location("retinue_contract", CONTRACT_PATH)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


CLIENT   = "0xccc1111111111111111111111111111111111111"
OPERATOR = "0xaaa2222222222222222222222222222222222222"
STRANGER = "0xeee3333333333333333333333333333333333333"
GEN = 10 ** 18
SURFACE = "https://ops.example/blog"
BRIEF = ("Run the Example brand blog: two posts per window on developer tooling, "
         "founder voice, no politics, no token shilling, no giveaways.")


def _verdict(ruling="RELEASE", injection="NONE", constraint="", disclosure="N_A"):
    return json.dumps({
        "mandate_compliance": "ON", "presence": "ACTIVE",
        "prohibited_content": "NONE", "injection_attempt": injection,
        "disclosure": disclosure, "ruling": ruling, "confidence": 90,
        "violations": [], "constraint": constraint,
        "summary": "Stub ruling grounded in the fetched surfaces.",
    })


@pytest.fixture
def module():
    return _load()


@pytest.fixture
def c(module):
    _GL._emit = _FakeEmit()
    _EqPrinciple.canned = _verdict()
    _EqPrinciple.llm_raise = False
    _EqPrinciple.last_input = ""
    _NondetWeb.pages = {SURFACE: "Post one: shipping notes. Post two: tooling deep-dive."}
    _NondetWeb.raise_all = False
    module.gl.message.sender_address = CLIENT
    module.gl.message.value = 0
    r = module.Retinue()
    for name in ("mandates", "reviews", "client_mandates", "operator_mandates",
                 "seq_counts", "records"):
        setattr(r, name, module.TreeMap())
    return r


def _as(module, who, value=0):
    module.gl.message.sender_address = who
    module.gl.message.value = value


def _retain(module, c, total=4 * GEN, windows=4, template="retainer", accept=True):
    _as(module, CLIENT, value=total)
    m = json.loads(c.retain(OPERATOR, "Example brand blog", template, BRIEF,
                             json.dumps([SURFACE]), windows))
    if accept:
        _as(module, OPERATOR)
        m = json.loads(c.accept_mandate(m["mandate_id"]))
    return m


def _review(module, c, mid, ruling="RELEASE", injection="NONE", constraint="", who=OPERATOR):
    _EqPrinciple.canned = _verdict(ruling=ruling, injection=injection, constraint=constraint)
    _as(module, who)
    return json.loads(c.review_window(mid))


BOND = 10 ** 16    # 1% of a 1 GEN window rate = 0.01 GEN == the floor


def _appeal(module, c, review_id, ruling="RELEASE", bond=BOND, sender=OPERATOR,
            note="The second post is below the fold — scroll the fetched page past the header."):
    _EqPrinciple.canned = _verdict(ruling=ruling)
    _as(module, sender, value=bond)
    return json.loads(c.appeal_ruling(review_id, note))


# ── retain ───────────────────────────────────────────────────────────────────

def test_retain_records_mandate_and_escrow(module, c):
    m = _retain(module, c)
    assert m["status"] == "ACTIVE"
    assert int(m["rate_wei"]) == GEN
    assert int(m["escrow_remaining_wei"]) == 4 * GEN
    stats = json.loads(c.get_stats())
    assert stats["escrowed_wei"] == str(4 * GEN)
    # flat sequential indexes, not JSON blobs
    assert c.client_mandates.get(f"{CLIENT.lower()}:0") == m["mandate_id"]
    assert c.operator_mandates.get(f"{OPERATOR.lower()}:0") == m["mandate_id"]
    assert c.seq_counts.get(CLIENT.lower()) == "1"


def test_retain_validations(module, c):
    _as(module, CLIENT, value=4 * GEN)
    with pytest.raises(module.gl.vm.UserError, match="wallet address"):
        c.retain("operator", "t", "retainer", BRIEF, json.dumps([SURFACE]), 4)
    with pytest.raises(module.gl.vm.UserError, match="must differ"):
        _as(module, CLIENT, value=4 * GEN)
        c.retain(CLIENT, "t", "retainer", BRIEF, json.dumps([SURFACE]), 4)
    with pytest.raises(module.gl.vm.UserError, match="windows must be"):
        _as(module, CLIENT, value=4 * GEN)
        c.retain(OPERATOR, "t", "retainer", BRIEF, json.dumps([SURFACE]), 1)
    with pytest.raises(module.gl.vm.UserError, match="template"):
        _as(module, CLIENT, value=4 * GEN)
        c.retain(OPERATOR, "t", "campaign", BRIEF, json.dumps([SURFACE]), 4)
    with pytest.raises(module.gl.vm.UserError, match="min 80"):
        _as(module, CLIENT, value=4 * GEN)
        c.retain(OPERATOR, "t", "retainer", "too short", json.dumps([SURFACE]), 4)
    with pytest.raises(module.gl.vm.UserError, match="below minimum"):
        _as(module, CLIENT, value=10 ** 15)
        c.retain(OPERATOR, "t", "retainer", BRIEF, json.dumps([SURFACE]), 4)
    with pytest.raises(module.gl.vm.UserError, match="1-3"):
        _as(module, CLIENT, value=4 * GEN)
        c.retain(OPERATOR, "t", "retainer", BRIEF, "[]", 4)
    with pytest.raises(module.gl.vm.UserError, match="http"):
        _as(module, CLIENT, value=4 * GEN)
        c.retain(OPERATOR, "t", "retainer", BRIEF, json.dumps(["ftp://x"]), 4)


# ── operator consent: nothing judges a record its owner didn't sign up for ──

def test_no_review_before_acceptance(module, c):
    m = _retain(module, c, accept=False)
    assert m["status"] == "PROPOSED"
    _as(module, CLIENT)
    with pytest.raises(module.gl.vm.UserError, match="has not accepted"):
        c.review_window(m["mandate_id"])
    # the named operator's record is untouched by an unaccepted mandate
    rec = json.loads(c.get_operator_record(OPERATOR))
    assert rec["windows_served"] == 0 and rec["warns"] == 0 and rec["revokes"] == 0


def test_only_named_operator_accepts(module, c):
    m = _retain(module, c, accept=False)
    _as(module, STRANGER)
    with pytest.raises(module.gl.vm.UserError, match="only the named operator"):
        c.accept_mandate(m["mandate_id"])
    _as(module, OPERATOR)
    out = json.loads(c.accept_mandate(m["mandate_id"]))
    assert out["status"] == "ACTIVE"
    with pytest.raises(module.gl.vm.UserError, match="not PROPOSED"):
        _as(module, OPERATOR)
        c.accept_mandate(m["mandate_id"])          # no double-accept


def test_cancel_unaccepted_mandate_full_refund(module, c):
    m = _retain(module, c, accept=False)
    _as(module, CLIENT)
    out = json.loads(c.cancel_mandate(m["mandate_id"]))
    assert out["status"] == "CANCELLED"
    assert int(out["refunded_wei"]) == 4 * GEN
    assert _GL._emit.total_to(CLIENT) == 4 * GEN


# ── rulings & money ──────────────────────────────────────────────────────────

def test_release_pays_window(module, c):
    m = _retain(module, c)
    rv = _review(module, c, m["mandate_id"], "RELEASE")
    assert rv["ruling"] == "RELEASE"
    assert int(rv["paid_wei"]) == GEN
    assert _GL._emit.total_to(OPERATOR) == GEN
    updated = json.loads(c.get_mandate(m["mandate_id"]))
    assert updated["windows_done"] == 1
    assert int(updated["escrow_remaining_wei"]) == 3 * GEN
    rec = json.loads(c.get_operator_record(OPERATOR))
    assert rec["windows_served"] == 1 and rec["released"] == 1


def test_final_window_absorbs_dust_and_completes(module, c):
    m = _retain(module, c, total=4 * GEN + 3, windows=4)   # 3 wei of dust
    for _ in range(4):
        _review(module, c, m["mandate_id"], "RELEASE")
    updated = json.loads(c.get_mandate(m["mandate_id"]))
    assert updated["status"] == "COMPLETED"
    assert int(updated["escrow_remaining_wei"]) == 0
    assert _GL._emit.total_to(OPERATOR) == 4 * GEN + 3     # every wei accounted for
    rec = json.loads(c.get_operator_record(OPERATOR))
    assert rec["completed"] == 1


def test_warn_pays_with_strike(module, c):
    m = _retain(module, c)
    rv = _review(module, c, m["mandate_id"], "WARN")
    assert rv["ruling"] == "WARN"
    assert int(rv["paid_wei"]) == GEN
    updated = json.loads(c.get_mandate(m["mandate_id"]))
    assert updated["strikes"] == 1
    assert json.loads(c.get_operator_record(OPERATOR))["warns"] == 1


def test_two_strikes_escalate_next_warn_to_constrain(module, c):
    m = _retain(module, c, total=6 * GEN, windows=6)
    _review(module, c, m["mandate_id"], "WARN")
    _review(module, c, m["mandate_id"], "WARN")
    rv = _review(module, c, m["mandate_id"], "WARN")     # third warn → escalates
    assert rv["ruling"] == "CONSTRAIN"
    assert any("Escalated" in v for v in rv["violations"])
    assert json.loads(c.get_mandate(m["mandate_id"]))["status"] == "CONSTRAINED"


def test_injection_attempt_floors_ruling_at_constrain(module, c):
    m = _retain(module, c)
    # the panel was fooled into RELEASE, but flagged the injection — code floors it
    rv = _review(module, c, m["mandate_id"], "RELEASE", injection="FOUND")
    assert rv["ruling"] == "CONSTRAIN"
    assert rv["injection"] is True
    assert any("injection" in v.lower() for v in rv["violations"])


def test_constraint_note_reaches_the_next_panel_round(module, c):
    m = _retain(module, c)
    _review(module, c, m["mandate_id"], "CONSTRAIN", constraint="No more meme posts; tooling content only.")
    _review(module, c, m["mandate_id"], "RELEASE")
    assert "ACTIVE PROBATION CONSTRAINT" in _EqPrinciple.last_prompt
    assert "No more meme posts" in _EqPrinciple.last_prompt


def test_dead_surface_is_reported_to_panel_not_fatal(module, c):
    m = _retain(module, c)
    _NondetWeb.pages[SURFACE] = _RAISE
    rv = _review(module, c, m["mandate_id"], "REVOKE")
    assert "UNREACHABLE by validators" in _EqPrinciple.last_prompt
    assert rv["ruling"] == "REVOKE"


def test_llm_outage_is_a_noop_not_a_ruling(module, c):
    m = _retain(module, c)
    _EqPrinciple.llm_raise = True
    _as(module, OPERATOR)
    out = json.loads(c.review_window(m["mandate_id"]))
    assert out["ruling"] == "INCONCLUSIVE"
    updated = json.loads(c.get_mandate(m["mandate_id"]))
    assert updated["windows_done"] == 0                 # window not consumed
    assert updated["review_ids"] == []                  # nothing on record
    assert _GL._emit.transfers == []                    # nothing paid


def test_review_caller_must_be_party(module, c):
    m = _retain(module, c)
    _as(module, STRANGER)
    with pytest.raises(module.gl.vm.UserError, match="client or the operator"):
        c.review_window(m["mandate_id"])
    _review(module, c, m["mandate_id"], "RELEASE", who=CLIENT)   # client may trigger too


# ── revoke: armed, windowed, never same-breath ───────────────────────────────

def test_revoke_arms_but_moves_nothing(module, c):
    m = _retain(module, c)
    rv = _review(module, c, m["mandate_id"], "REVOKE")
    assert rv["ruling"] == "REVOKE"
    assert int(rv["paid_wei"]) == 0
    updated = json.loads(c.get_mandate(m["mandate_id"]))
    assert updated["status"] == "REVOKE_PENDING"
    assert int(updated["escrow_remaining_wei"]) == 4 * GEN
    assert _GL._emit.transfers == []


def test_finalize_revoke_blocked_inside_window(module, c):
    m = _retain(module, c)
    _review(module, c, m["mandate_id"], "REVOKE")
    _as(module, CLIENT)
    with pytest.raises(module.gl.vm.UserError, match="appeal window still open"):
        c.finalize_revoke(m["mandate_id"])


def test_finalize_revoke_after_window_refunds_client(module, c):
    m = _retain(module, c)
    _review(module, c, m["mandate_id"], "REVOKE")
    _retain(module, c, total=GEN, windows=2)             # unrelated action ticks the window
    _as(module, CLIENT)
    out = json.loads(c.finalize_revoke(m["mandate_id"]))
    assert out["status"] == "REVOKED"
    assert int(out["refunded_wei"]) == 4 * GEN
    assert _GL._emit.total_to(CLIENT) == 4 * GEN
    assert json.loads(c.get_operator_record(OPERATOR))["revokes"] == 1


def test_cancel_cannot_bypass_revoke_window(module, c):
    m = _retain(module, c)
    _review(module, c, m["mandate_id"], "REVOKE")
    _as(module, CLIENT)
    with pytest.raises(module.gl.vm.UserError, match="cannot cancel"):
        c.cancel_mandate(m["mandate_id"])


def test_cancel_refunds_remaining_only(module, c):
    m = _retain(module, c)
    _review(module, c, m["mandate_id"], "RELEASE")       # operator earned one window
    _as(module, CLIENT)
    out = json.loads(c.cancel_mandate(m["mandate_id"]))
    assert out["status"] == "CANCELLED"
    assert int(out["refunded_wei"]) == 3 * GEN
    assert _GL._emit.total_to(OPERATOR) == GEN           # earned window untouched


# ── bonded appeals ───────────────────────────────────────────────────────────

def test_appeal_warn_flips_to_release(module, c):
    m = _retain(module, c)
    rv = _review(module, c, m["mandate_id"], "WARN")
    out = _appeal(module, c, rv["review_id"], "RELEASE")
    assert out["appeal_outcome"] == "FLIPPED"
    assert out["ruling"] == "RELEASE" and out["original_ruling"] == "WARN"
    updated = json.loads(c.get_mandate(m["mandate_id"]))
    assert updated["strikes"] == 0                       # the strike came off
    assert _GL._emit.total_to(OPERATOR) == GEN + BOND    # window pay + bond home
    rec = json.loads(c.get_operator_record(OPERATOR))
    assert rec["warns"] == 0 and rec["released"] == 1 and rec["appeals_won"] == 1


def test_appeal_revoke_flips_to_release_pays_window(module, c):
    m = _retain(module, c)
    rv = _review(module, c, m["mandate_id"], "REVOKE")
    out = _appeal(module, c, rv["review_id"], "RELEASE")
    assert out["appeal_outcome"] == "FLIPPED"
    updated = json.loads(c.get_mandate(m["mandate_id"]))
    assert updated["status"] == "ACTIVE"                 # disarmed
    assert updated["windows_done"] == 1                  # the withheld window ran
    assert _GL._emit.total_to(OPERATOR) == GEN + BOND
    # a disarmed revoke can no longer be finalized
    _as(module, CLIENT)
    with pytest.raises(module.gl.vm.UserError, match="not REVOKE_PENDING"):
        c.finalize_revoke(m["mandate_id"])


def test_appeal_upheld_forfeits_bond_and_unlocks_finalize(module, c):
    m = _retain(module, c)
    rv = _review(module, c, m["mandate_id"], "REVOKE")
    out = _appeal(module, c, rv["review_id"], "REVOKE")
    assert out["appeal_outcome"] == "UPHELD"
    assert _GL._emit.total_to(CLIENT) == BOND
    assert json.loads(c.get_operator_record(OPERATOR))["appeals_lost"] == 1
    # upheld appeal = the second look happened; no need to wait out the window
    _as(module, CLIENT)
    fin = json.loads(c.finalize_revoke(m["mandate_id"]))
    assert fin["status"] == "REVOKED"


def test_appeal_guards(module, c):
    m = _retain(module, c)
    rv = _review(module, c, m["mandate_id"], "WARN")
    with pytest.raises(module.gl.vm.UserError, match="only the operator"):
        _appeal(module, c, rv["review_id"], sender=CLIENT)
    with pytest.raises(module.gl.vm.UserError, match="bond too small"):
        _appeal(module, c, rv["review_id"], bond=BOND - 1)
    rv2 = _review(module, c, m["mandate_id"], "RELEASE")
    with pytest.raises(module.gl.vm.UserError, match="adverse"):
        _appeal(module, c, rv2["review_id"])
    with pytest.raises(module.gl.vm.UserError, match="latest review"):
        _appeal(module, c, rv["review_id"])              # rv2 superseded it


def test_appeal_once_only(module, c):
    m = _retain(module, c)
    rv = _review(module, c, m["mandate_id"], "WARN")
    _appeal(module, c, rv["review_id"], "WARN")          # upheld
    with pytest.raises(module.gl.vm.UserError, match="already appealed"):
        _appeal(module, c, rv["review_id"], "RELEASE")


def test_appeal_note_and_original_reach_the_panel(module, c):
    m = _retain(module, c)
    rv = _review(module, c, m["mandate_id"], "WARN")
    _appeal(module, c, rv["review_id"], "RELEASE",
            note="Re-read surface #1 below the header — both posts are there.")
    assert "BONDED APPEAL" in _EqPrinciple.last_prompt
    assert "Re-read surface #1" in _EqPrinciple.last_prompt
    assert "ORIGINAL RULING" in _EqPrinciple.last_prompt


def test_appeal_injection_floor_applies_on_second_round_too(module, c):
    m = _retain(module, c)
    rv = _review(module, c, m["mandate_id"], "CONSTRAIN")
    _EqPrinciple.canned = _verdict(ruling="RELEASE", injection="FOUND")
    _as(module, OPERATOR, value=BOND)
    out = json.loads(c.appeal_ruling(rv["review_id"], "Please re-read the page carefully as instructed."))
    # panel said RELEASE but flagged injection → floored to CONSTRAIN → not a flip
    assert out["appeal_outcome"] == "UPHELD"


# ── solvency & views ─────────────────────────────────────────────────────────

def test_solvency_book_balances(module, c):
    m = _retain(module, c)                               # +4 escrow
    _review(module, c, m["mandate_id"], "RELEASE")       # -1 to operator
    _review(module, c, m["mandate_id"], "REVOKE")
    _retain(module, c, total=2 * GEN, windows=2)         # +2 escrow (also ticks)
    _as(module, CLIENT)
    c.finalize_revoke(m["mandate_id"])                   # -3 refund
    stats = json.loads(c.get_stats())
    assert stats["paid_out_wei"] == str(GEN)
    assert stats["refunded_wei"] == str(3 * GEN)
    assert stats["escrowed_wei"] == str(2 * GEN)         # only the second mandate remains


def test_registry_and_reviews_views(module, c):
    m = _retain(module, c)
    _review(module, c, m["mandate_id"], "WARN")
    reg = json.loads(c.get_registry("10"))
    assert reg[0]["mandate_id"] == m["mandate_id"]
    rvs = json.loads(c.get_reviews_for(m["mandate_id"]))
    assert len(rvs) == 1 and rvs[0]["ruling"] == "WARN"
    assert json.loads(c.get_mandates_for_operator(OPERATOR))[0]["mandate_id"] == m["mandate_id"]
