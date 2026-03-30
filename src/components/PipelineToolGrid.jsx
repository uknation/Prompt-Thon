import { Box, FileText, Layers3, ScanSearch, Wrench } from 'lucide-react';

const toolIcons = [ScanSearch, Wrench, Box, Layers3, FileText];

export default function PipelineToolGrid({ stages, currentStage, completedStage, onLaunch }) {
  return (
    <section id="features" className="rounded-[34px] border border-white/10 bg-[#171d2c]/82 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.24)] backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#ff975b]">Pipeline Tools</p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Use Each Pipeline Stage Like Its Own Tool</h2>
          <p className="mt-3 max-w-3xl text-base leading-8 text-[#a8b0c5]">
            Launch the parser, reconstruction engine, third-person 3D viewer, material evaluator, and explainability report individually, or run the full flow from the hero generator.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
          Completed stage: {completedStage ? completedStage : 0} / {stages.length}
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-5">
        {stages.map((stage, index) => {
          const Icon = toolIcons[index] || Wrench;
          const isActive = currentStage === index;
          const isDone = completedStage > index;

          return (
            <article
              key={stage.id}
              className={`rounded-[28px] border p-5 transition ${isActive ? 'border-[#ff975b]/55 bg-[#282d40] shadow-[0_20px_45px_rgba(255,151,91,0.1)]' : 'border-white/10 bg-white/5 hover:bg-white/7'}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${isActive ? 'bg-[#ff975b] text-[#212636]' : isDone ? 'bg-[#d8ff52] text-[#1c2434]' : 'bg-white/8 text-white'}`}>
                  <Icon size={22} />
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${isActive ? 'bg-[#ff975b]/20 text-[#ffb48c]' : isDone ? 'bg-[#d8ff52]/16 text-[#d8ff52]' : 'bg-white/8 text-white/55'}`}>
                  {isActive ? 'Active' : isDone ? 'Ready' : 'Tool'}
                </span>
              </div>

              <h3 className="mt-6 text-xl font-semibold text-white">{stage.label}</h3>
              <p className="mt-2 min-h-[48px] text-sm leading-6 text-[#a8b0c5]">{stage.subtitle}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.22em] text-white/45">
                {isActive ? 'Currently focused' : isDone ? 'Already processed in this session' : 'Available to run'}
              </p>

              <button
                type="button"
                onClick={() => onLaunch(index)}
                className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-[#ff975b] text-[#1f2433]' : 'border border-white/12 bg-white/6 text-white hover:bg-white/10'}`}
              >
                {index === 0 ? 'Run Parser Tool' : index === stages.length - 1 ? 'Build Final Report' : `Open ${stage.label}`}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
