import { FileDown } from 'lucide-react';
import StageCard from '../components/StageCard';
import EmptyStageState from '../components/EmptyStageState';

export default function ReportSection({ report, reportMeta, onExport }) {
  return (
    <StageCard
      eyebrow="Stage 5"
      title="Explainability Report"
      subtitle="The app generates a production-ready narrative from the same structured payload used by earlier stages. You can ship this locally today and swap in a backend LLM later without reworking the UX."
      actions={(
        <button
          type="button"
          onClick={onExport}
          disabled={!report.length}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <FileDown size={16} />
          Export Report
        </button>
      )}
    >
      {!report.length ? (
        <EmptyStageState
          title="Report Waiting"
          description="Run the pipeline through geometry and material analysis first. Once those stages are available, the report engine will assemble an explainable delivery summary here."
          hint="Stage 5 composes the final narrative"
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge label="Source" value={reportMeta?.source === 'llm' ? 'LLM' : 'Template'} tone={reportMeta?.source === 'llm' ? 'lime' : 'aqua'} />
            <StatusBadge label="Reason" value={formatReason(reportMeta?.reason)} tone="coral" />
            {reportMeta?.provider ? <StatusBadge label="Provider" value={reportMeta.provider} tone="slate" /> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {report.map((section) => (
              <article key={section.title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-aqua">{section.title}</p>
                <p className="mt-3 text-sm leading-7 text-fog">{section.body}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </StageCard>
  );
}

function StatusBadge({ label, value, tone }) {
  const toneMap = {
    aqua: 'border-aqua/20 bg-aqua/10 text-aqua',
    coral: 'border-coral/20 bg-coral/10 text-coral',
    lime: 'border-lime/20 bg-lime/10 text-lime',
    slate: 'border-white/10 bg-white/5 text-white/75',
  };

  return (
    <span className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] ${toneMap[tone] || toneMap.slate}`}>
      {label}: {value}
    </span>
  );
}

function formatReason(reason) {
  if (!reason) return 'ready';
  return reason.replace(/-/g, ' ');
}
