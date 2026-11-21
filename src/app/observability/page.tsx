"use client";

import { useEffect, useState } from "react";

interface Report {
  strategy: string;
  n: number;
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number;
  citationPrecisionAt5: number;
  citationSupport: number;
  misses: string[];
}

export default function ObservabilityPage() {
  const [data, setData] = useState<{ table: string; reports: Report[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/observability/retrieval")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Retrieval evaluation</h1>
      <p className="text-sm text-muted-foreground">
        Measured retrieval quality over the versioned eval corpus (no DB or API key required).
      </p>
      {error && <p className="text-red-500">{error}</p>}
      {!data && !error && <p>Loading…</p>}
      {data && (
        <>
          <pre className="rounded-md bg-muted p-4 text-xs overflow-x-auto">{data.table}</pre>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Strategy</th>
                <th className="p-2">Recall@1</th>
                <th className="p-2">Recall@3</th>
                <th className="p-2">Recall@5</th>
                <th className="p-2">MRR</th>
                <th className="p-2">Citation precision@5</th>
                <th className="p-2">Citation support</th>
                <th className="p-2">Misses</th>
              </tr>
            </thead>
            <tbody>
              {data.reports.map((r) => (
                <tr key={r.strategy} className="border-b">
                  <td className="p-2 font-medium">{r.strategy}</td>
                  <td className="p-2 text-center">{pct(r.recallAt1)}</td>
                  <td className="p-2 text-center">{pct(r.recallAt3)}</td>
                  <td className="p-2 text-center">{pct(r.recallAt5)}</td>
                  <td className="p-2 text-center">{pct(r.mrr)}</td>
                  <td className="p-2 text-center">{pct(r.citationPrecisionAt5)}</td>
                  <td className="p-2 text-center">{pct(r.citationSupport)}</td>
                  <td className="p-2 text-center">{r.misses.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}