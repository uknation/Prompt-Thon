export default function MaterialPanel({ materials }) {
  if (!materials) {
    return <EmptyState message="Material scoring appears after the structural graph is converted into 3D elements." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Elements Scored" value={materials.summary.total_elements} />
        <SummaryCard label="Critical Spans" value={materials.summary.critical_span_count} />
        <SummaryCard label="Preferred Partition" value={materials.summary.preferred_partition_material} />
      </div>

      <div className="space-y-3">
        {materials.results.slice(0, 10).map((item) => (
          <article key={item.element_id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">Element {item.element_id}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">{item.wall_type.replace('_', ' ')}</p>
              </div>
              <p className="text-xs text-slate-400">Span {item.governing_span.toFixed(2)}m</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{item.governing_reason}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {item.recommendations.slice(0, 3).map((recommendation) => (
                <div key={recommendation.material} className="rounded-[18px] border border-white/10 bg-slate-950/80 p-3">
                  <p className="text-sm font-semibold text-white">{recommendation.material}</p>
                  <p className="mt-1 text-xs text-slate-400">Score {recommendation.score.toFixed(2)}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{recommendation.rationale}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-slate-950/70 p-8 text-center text-sm leading-6 text-slate-400">
      {message}
    </div>
  );
}
