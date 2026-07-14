"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { getMandatesForClient, getMandatesForOperator, type Mandate } from "@/lib/retinue";
import { MandateCard } from "@/components/Bits";

export default function Desk() {
  const { address, connect, connecting } = useWallet();
  const [tab, setTab] = useState<"client" | "operator">("client");
  const [asClient, setAsClient] = useState<Mandate[]>([]);
  const [asOperator, setAsOperator] = useState<Mandate[]>([]);

  useEffect(() => {
    if (!address) return;
    getMandatesForClient(address).then(setAsClient).catch(() => {});
    getMandatesForOperator(address).then(setAsOperator).catch(() => {});
  }, [address]);

  if (!address) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <h1 className="display text-2xl">My desk</h1>
        <p className="mt-3 text-sm muted">Connect to see mandates where you are the client or the operator.</p>
        <button onClick={() => connect().catch(() => {})} disabled={connecting} className="btn btn-signal mt-6">
          {connecting ? "Connecting…" : "Connect"}
        </button>
      </div>
    );
  }

  const shown = tab === "client" ? asClient : asOperator;
  const pendingAccept = asOperator.filter((m) => m.status === "PROPOSED").length;

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-8">
      <p className="eyebrow mb-2">My desk</p>
      <h1 className="display mb-5" style={{ fontSize: "clamp(24px,4vw,36px)" }}>Mandates</h1>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("client")} className={tab === "client" ? "btn" : "btn-ghost"} style={{ fontSize: "0.8rem" }}>
          As client ({asClient.length})
        </button>
        <button onClick={() => setTab("operator")} className={tab === "operator" ? "btn" : "btn-ghost"} style={{ fontSize: "0.8rem" }}>
          As operator ({asOperator.length}){pendingAccept > 0 ? ` · ${pendingAccept} awaiting your acceptance` : ""}
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm muted">
            {tab === "client" ? "You haven't retained anyone yet." : "No mandates name you as operator yet."}
          </p>
          {tab === "client" && <Link href="/new" className="btn btn-signal mt-4 inline-flex">Open a mandate</Link>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((m) => <MandateCard key={m.mandate_id} m={m} />)}
        </div>
      )}
    </div>
  );
}
