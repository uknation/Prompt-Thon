import MetricCard from './MetricCard';
import { formatCurrencyLakh } from '../lib/format';

export default function Sidebar({ run, geometry, materialAnalysis, history }) {
  return (
    <aside className="space-y-5 lg:sticky lg:top-6">
      <section className="rounded-[28px] border border-white/10 bg-panel/75 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.24em] text-fog">Pipeline Snapshot</p>
        <h3 className="mt-3 text-xl font-semibold">{run?.plan?.name ?? 'No active run yet'}</h3>
        <p className="mt-2 text-sm text-fog">{run?.plan?.description ?? 'Load a sample or upload a plan image to begin.'}</p>
        <div className="mt-5 grid gap-3">
          <MetricCard label="Rooms" value={geometry?.rooms.length ?? '-'} />
          <MetricCard label="Junctions" value={geometry?.junctions.length ?? '-'} accent="text-aqua" />
          <MetricCard label="Budget" value={materialAnalysis ? formatCurrencyLakh(materialAnalysis.summary.totalCostLakh) : '-'} accent="text-coral" />
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-panel/75 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.24em] text-fog">Recent Runs</p>
        <div className="mt-4 space-y-3">
          {history.length ? history.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="font-medium text-white">{item.planName}</p>
              <p className="mt-1 text-sm text-fog">{item.timestamp}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-aqua">Stage {item.completedStage + 1} reached</p>
            </div>
          )) : <p className="text-sm text-fog">No runs saved yet.</p>}
        </div>
      </section>
    </aside>
  );
}
