import { FileDown } from 'lucide-react';
import StageCard from '../components/StageCard';

export default function ReportSection({ report, onExport }) {
  return (
    <StageCard
      eyebrow="Stage 5"
      title="Explainability Report"
      subtitle="The app generates a production-ready narrative from the same structured payload used by earlier stages. You can ship this locally today and swap in a backend LLM later without reworking the UX."
      actions={(
        <button type="button" onClick={onExport} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10">
          <FileDown size={16} />
          Export Report
        </button>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {report.map((section) => (
          <article key={section.title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-aqua">{section.title}</p>
            <p className="mt-3 text-sm leading-7 text-fog">{section.body}</p>
          </article>
        ))}
      </div>
    </StageCard>
  );
}
