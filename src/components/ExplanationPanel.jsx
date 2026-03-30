export default function ExplanationPanel({ explainability }) {
  if (!explainability) {
    return <EmptyState message="Explainability is generated only after material scoring completes." />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-7 text-amber-100">
        {explainability.summary}
      </div>

      <div className="space-y-3">
        {explainability.results.map((item) => (
          <article key={item.element_id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-white">Element {item.element_id}</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">{item.explanation}</p>
          </article>
        ))}
      </div>
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
