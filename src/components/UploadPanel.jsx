export default function UploadPanel({
  sampleOptions,
  selectedPlanId,
  onSelectPlan,
  uploadedFile,
  uploadPreview,
  onUpload,
  onClearUpload,
  onRun,
  isRunning,
  backendStatus,
}) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300">Upload</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Autonomous Structural Intelligence System
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Run a complete, contract-driven structural pipeline from plan parsing through geometry reasoning,
              3D generation, material recommendation, and explainability.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Sample Plan</span>
              <select
                value={selectedPlanId}
                onChange={(event) => onSelectPlan(event.target.value)}
                disabled={Boolean(uploadedFile)}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300/60"
              >
                {sampleOptions.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-400">
                Sample mode uses structured plan input to prove deterministic pipeline execution.
              </p>
            </label>

            <label className="rounded-[24px] border border-dashed border-white/20 bg-white/[0.03] p-4 transition hover:border-amber-300/50">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Image Upload</span>
              <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-5 text-sm text-slate-300">
                <p className="font-medium text-white">{uploadedFile ? uploadedFile.name : 'Choose a floor-plan image'}</p>
                <p className="mt-1 text-xs text-slate-400">PNG, JPG, or screenshot of a plan. Only stage 1 touches raw pixels.</p>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRun}
              disabled={isRunning}
              className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunning ? 'Running Pipeline...' : 'Run End-to-End Pipeline'}
            </button>
            {uploadedFile ? (
              <button
                type="button"
                onClick={onClearUpload}
                className="rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Clear Upload
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Run Context</p>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${backendStatus.ok ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200'}`}>
              {backendStatus.ok ? 'Backend Online' : 'Backend Offline'}
            </span>
          </div>
          <div className="overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/70">
            {uploadPreview ? (
              <img src={uploadPreview} alt="Uploaded plan preview" className="h-[240px] w-full object-cover" />
            ) : (
              <div className="flex h-[240px] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),transparent_42%),linear-gradient(160deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] p-6 text-center">
                <div>
                  <p className="text-lg font-semibold text-white">Stage-mapped viewer</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Each panel below reads directly from one validated pipeline stage so judges can inspect the trace without manual intervention.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Input" value={uploadedFile ? 'Image Upload' : 'Structured Plan'} />
            <Metric label="Execution" value="FastAPI Orchestrator" />
            <Metric label="Reasoning" value="Topology + Span Rules" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
