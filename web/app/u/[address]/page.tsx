"use client";

import { use, useEffect, useState } from "react";
import { getOperatorRecord, getMandatesForOperator, shortAddr, type OperatorRecord, type Mandate } from "@/lib/retinue";
import { MandateCard, Stat } from "@/components/Bits";

export default function OperatorProfile({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const [rec, setRec] = useState<OperatorRecord | null>(null);
  const [mandates, setMandates] = useState<Mandate[]>([]);

  useEffect(() => {
    getOperatorRecord(address).then(setRec).catch(() => {});
    getMandatesForOperator(address).then(setMandates).catch(() => {});
  }, [address]);

  const clean = rec ? rec.windows_served - rec.warns - rec.constrains : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-6 py-8">
      <p className="eyebrow mb-2">Operator record · public and portable</p>
      <h1 className="display mono" style={{ fontSize: "clamp(18px,3vw,26px)", wordBreak: "break-all" }}>{address}</h1>
      <p className="text-sm muted mt-2" style={{ maxWidth: "60ch" }}>
        An operator&apos;s record is the one deliberately public thing on Retinue: how their work
        held up under standing review. It follows {shortAddr(address)} to every future mandate.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 mb-3">
        <Stat label="Windows served" value={rec ? String(rec.windows_served) : "—"} hint={rec ? `${clean >= 0 ? clean : 0} clean` : undefined} />
        <Stat label="Mandates completed" value={rec ? String(rec.completed) : "—"} />
        <Stat label="Warns / constrains" value={rec ? `${rec.warns} / ${rec.constrains}` : "—"} />
        <Stat label="Revokes" value={rec ? String(rec.revokes) : "—"} />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-8" style={{ maxWidth: 420 }}>
        <Stat label="Appeals won" value={rec ? String(rec.appeals_won) : "—"} />
        <Stat label="Appeals lost" value={rec ? String(rec.appeals_lost) : "—"} />
      </div>

      <h2 className="display text-lg mb-3">Mandates</h2>
      {mandates.length === 0 ? (
        <div className="panel p-8 text-center"><p className="text-sm muted">No mandates on record.</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mandates.map((m) => <MandateCard key={m.mandate_id} m={m} />)}
        </div>
      )}
    </div>
  );
}
