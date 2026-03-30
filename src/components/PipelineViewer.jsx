const STAGE_LABELS = [
  ['parsing', '1. Parsing'],
  ['validation', '2. Validation'],
  ['geometry', '3. Geometry'],
  ['model3d', '4. 3D Model'],
  ['materials', '5. Materials'],
  ['explainability', '6. Explainability'],
];

export default function PipelineViewer({ result, onDownloadTrace }) {
  const logs = result?.logs || [];
  const warnings = result?.warnings || [];
  const stageOutputs = result?.stage_outputs || null;

  return (
    <section className="rounded-[30px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300">Pipeline Viewer</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Execution Trace</h2>
        </div>
        <button
          type="button"
          onClick={onDownloadTrace}
          disabled={!result}
          className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Download Trace JSON
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {STAGE_LABELS.map(([key, label]) => {
            const log = logs.find((item) => item.stage === key);
            const ready = Boolean(stageOutputs?.[key]);
            return (
              <article key={key} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ready ? 'bg-emerald-400/20 text-emerald-200' : 'bg-slate-700/50 text-slate-300'}`}>
                    {ready ? 'Ready' : 'Idle'}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {log?.message || 'Awaiting pipeline execution.'}
                </p>
              </article>
            );
          })}
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Diagnostics</p>
          {warnings.length ? (
            <ul className="mt-4 space-y-3">
              {warnings.map((warning) => (
                <li key={warning} className="rounded-[18px] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
                  {warning}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-[18px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100">
              No blocking warnings. Geometry corrections were either unnecessary or fully resolved.
            </p>
          )}

          <details className="mt-4 rounded-[18px] border border-white/10 bg-slate-950/80 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-white">View Raw Stage Trace</summary>
            <pre className="mt-4 max-h-[280px] overflow-auto rounded-2xl bg-slate-950 px-4 py-3 text-xs leading-6 text-slate-300">
              {stageOutputs ? JSON.stringify(stageOutputs, null, 2) : 'Run the pipeline to inspect structured stage output.'}
            </pre>
          </details>
        </div>
      </div>
    </section>
  );
}
