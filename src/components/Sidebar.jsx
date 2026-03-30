import MetricCard from './MetricCard';
import { formatCurrencyLakh } from '../lib/format';

const stageLabels = ['Parser', 'Geometry', '3D Model', 'Materials', 'Report'];

export default function Sidebar({
  plan,
  geometry,
  materialAnalysis,
  history,
  currentStage,
  completedStage,
  selectedSource,
  backendStatus,
  executionMode,
  reportMode,
  reportMeta,
  executionSource,
}) {
  return (
    <aside className="space-y-5 lg:sticky lg:top-6">
      <section className="rounded-[28px] border border-white/10 bg-panel/75 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.24em] text-fog">Pipeline Snapshot</p>
        <h3 className="mt-3 text-xl font-semibold">{plan?.name ?? 'No plan selected yet'}</h3>
        <p className="mt-2 text-sm text-fog">
          {plan?.description ?? 'Describe a project or upload a plan image to begin.'}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{selectedSource}</Badge>
          {plan?.purpose ? <Badge>{plan.purpose}</Badge> : null}
        </div>

        <div className="mt-5 grid gap-3">
          <MetricCard label="Rooms" value={geometry?.rooms.length ?? '-'} />
          <MetricCard label="Walls" value={geometry?.walls.length ?? '-'} accent="text-aqua" />
          <MetricCard label="Openings" value={geometry?.openings.length ?? '-'} accent="text-lime" />
          <MetricCard label="Budget" value={materialAnalysis ? formatCurrencyLakh(materialAnalysis.summary.totalCostLakh) : '-'} accent="text-coral" />
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-panel/75 p-5 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.24em] text-fog">Workflow Status</p>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
            Step {currentStage + 1} active
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {stageLabels.map((label, index) => {
            const isDone = completedStage > index;
            const isActive = currentStage === index;
            return (
              <div key={label} className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${isActive ? 'border-aqua/30 bg-aqua/10' : isDone ? 'border-lime/20 bg-lime/10' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-center gap-3">
                  <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold ${isActive ? 'bg-aqua/20 text-aqua' : isDone ? 'bg-lime text-ink' : 'bg-white/10 text-fog'}`}>
                    {index + 1}
                  </div>
                  <p className="text-sm font-medium text-white">{label}</p>
                </div>
                <p className={`text-xs uppercase tracking-[0.2em] ${isActive ? 'text-aqua' : isDone ? 'text-lime' : 'text-fog'}`}>
                  {isActive ? 'Active' : isDone ? 'Done' : 'Waiting'}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-panel/75 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.24em] text-fog">Execution Layer</p>
        <div className="mt-4 grid gap-3">
          <MetricCard label="Mode" value={formatModeLabel(executionMode)} accent="text-aqua" />
          <MetricCard label="Engine" value={executionSource === 'fastapi' ? 'FastAPI' : 'Local'} accent="text-lime" />
          <MetricCard label="API" value={backendStatus?.state === 'online' ? 'Online' : backendStatus?.state === 'checking' ? 'Checking' : 'Offline'} accent="text-coral" />
          <MetricCard label="Report" value={reportMeta?.source === 'llm' ? 'LLM' : formatReportMode(reportMode)} />
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-fog">
          {reportMeta?.source === 'llm'
            ? `Provider: ${reportMeta.provider}${reportMeta.model ? ` (${reportMeta.model})` : ''}`
            : backendStatus?.llm?.configured
              ? `LLM is configured on the backend, but the current run used the ${reportMeta?.source || 'template'} path.`
              : 'No LLM provider is configured yet, so the report stage stays on the local explainability template.'}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-panel/75 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.24em] text-fog">Recent Runs</p>
        <div className="mt-4 space-y-3">
          {history.length ? history.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="font-medium text-white">{item.planName}</p>
              <p className="mt-1 text-sm text-fog">{item.timestamp}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-aqua">
                {item.completedStage >= stageLabels.length ? 'Pipeline complete' : `${stageLabels[item.completedStage - 1] || 'Pipeline'} reached`}
              </p>
            </div>
          )) : <p className="text-sm text-fog">No runs saved yet.</p>}
        </div>
      </section>
    </aside>
  );
}

function Badge({ children }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
      {children}
    </span>
  );
}

function formatModeLabel(mode) {
  if (mode === 'backend') return 'FastAPI only';
  if (mode === 'local') return 'Local only';
  return 'Auto';
}

function formatReportMode(mode) {
  return mode === 'template' ? 'Template' : 'Auto';
}
