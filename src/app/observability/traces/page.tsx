"use client";

import { useEffect, useState } from "react";

interface TraceSummary {
  id: string;
  question: string;
  startedAt: number;
  durationMs?: number;
}

export default function TracesPage() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selected, setSelected] = useState<unknown>(null);

  useEffect(() => {
    fetch("/api/observability/traces")
      .then((r) => r.json())
      .then((d) => setTraces(d.traces ?? []));
  }, []);

  async function open(id: string) {
    const r = await fetch(`/api/observability/traces/${id}`);
    const d = await r.json();
    setSelected(d.trace);
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Trace inspector</h1>
      <div className="grid grid-cols-2 gap-4">
        <ul className="space-y-2">
          {traces.map((t) => (
            <li key={t.id}>
              <button className="text-left text-sm hover:underline" onClick={() => open(t.id)}>
                {t.question}
              </button>
              <span className="ml-2 text-xs text-muted-foreground">{t.durationMs ?? 0}ms</span>
            </li>
          ))}
          {traces.length === 0 && <li className="text-sm text-muted-foreground">No traces yet.</li>}
        </ul>
        <pre className="rounded-md bg-muted p-4 text-xs overflow-auto max-h-[70vh]">
          {selected ? JSON.stringify(selected, null, 2) : "Select a trace."}
        </pre>
      </div>
    </main>
  );
}