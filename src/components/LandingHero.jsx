import { MoonStar, Paperclip, Sparkles } from 'lucide-react';
import { samplePlans } from '../data/plans';

export default function LandingHero({
  prompt,
  onPromptChange,
  onGenerate,
  onUpload,
  selectedPlan,
  onSelectPlan,
  uploadedPlan,
  isParsing,
  executionMode,
  onExecutionModeChange,
  reportMode,
  onReportModeChange,
  backendStatus,
}) {
  const activePlan = samplePlans[selectedPlan];

  return (
    <section id="about" className="overflow-hidden rounded-[38px] border border-white/10 bg-[#383b4b] shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
      <div className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_42%),linear-gradient(180deg,rgba(8,11,21,0.08),rgba(8,11,21,0.46))]" />
        <div className="absolute left-[-4%] top-[16%] h-[72%] w-[28%] rounded-[32px] border border-white/6 bg-white/4 blur-[2px]" />
        <div className="absolute right-[-4%] top-[16%] h-[72%] w-[28%] rounded-[32px] border border-white/6 bg-white/4 blur-[2px]" />
        <div className="absolute left-[17%] top-[11%] h-[72%] w-px bg-white/6" />
        <div className="absolute right-[17%] top-[11%] h-[72%] w-px bg-white/6" />

        <nav className="relative flex items-center justify-between border-b border-white/8 bg-[#313445]/88 px-6 py-5 backdrop-blur">
          <a href="#about" className="flex items-center gap-3 text-white">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 ring-1 ring-white/10">
              <div className="grid grid-cols-2 gap-[3px]">
                <span className="h-3 w-3 rounded-sm bg-white" />
                <span className="h-3 w-3 rounded-sm bg-white/85" />
                <span className="h-3 w-3 rounded-sm bg-white/85" />
                <span className="h-3 w-3 rounded-sm bg-white" />
              </div>
            </div>
            <span className="text-[2rem] font-bold tracking-tight">Structure.AI</span>
          </a>

          <div className="hidden items-center gap-14 text-[1.05rem] text-white/95 md:flex">
            <a href="#about" className="transition hover:text-[#ff975b]">About Us</a>
            <a href="#features" className="transition hover:text-[#ff975b]">Features</a>
            <a href="#contact" className="transition hover:text-[#ff975b]">Contact Us</a>
          </div>

          <button
            type="button"
            className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-[#ffd463] ring-1 ring-white/12 transition hover:bg-white/15"
            aria-label="Decorative theme control"
          >
            <MoonStar size={22} />
          </button>
        </nav>

        <div className="relative px-6 pb-10 pt-12 md:px-10 md:pb-14 md:pt-14 xl:px-16">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.36em] text-[#ff975b] md:text-base">
              Syntax To Structures
            </p>
            <h1 className="mx-auto mt-7 max-w-5xl text-5xl font-black leading-[1.08] text-white md:text-7xl">
              Transform Your <span className="text-[#ff975b]">Architectural</span>
              <br />
              <span className="text-[#ff975b]">Planning</span> with AI
            </h1>
            <p className="mx-auto mt-8 max-w-3xl text-xl leading-9 text-[#c5cbda] md:text-[2rem] md:leading-[3rem]">
              Generate precise, customizable, and build-ready architectural flows instantly, then inspect the parser, geometry, 3D model, materials, and report in one connected workspace.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-5xl rounded-[34px] border border-[#ff975b]/55 bg-[#414557]/88 px-6 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <StatusPill label="Current input" value={uploadedPlan ? 'Custom upload' : activePlan ? `Plan ${activePlan.id}` : 'No plan'} />
              {activePlan?.purpose ? <StatusPill label="Purpose" value={activePlan.purpose} /> : null}
              <StatusPill label="Output" value="5-stage structural pipeline" />
            </div>

            <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,0.9fr)]">
              <ModeSelector
                title="Pipeline Engine"
                description="Keep it simple with auto mode, force FastAPI, or stay local-only."
                value={executionMode}
                onChange={onExecutionModeChange}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'backend', label: 'FastAPI' },
                  { value: 'local', label: 'Local' },
                ]}
              />
              <ModeSelector
                title="Report Engine"
                description="Auto uses the backend report flow and switches to the LLM only when it is configured."
                value={reportMode}
                onChange={onReportModeChange}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'template', label: 'Template' },
                ]}
              />
              <BackendCard backendStatus={backendStatus} />
            </div>

            <textarea
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              className="h-28 w-full resize-none border-0 bg-transparent text-2xl leading-10 text-white outline-none placeholder:text-white/45 md:h-32"
              placeholder="Design a split-level home with a home office..."
            />

            <div className="mt-4 h-px bg-white/10" />

            <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-[#83a7ff]/75 bg-[#44506d]/55 px-6 py-3 text-lg text-[#9dbafc] transition hover:bg-[#506080]/55">
                  <Paperclip size={20} />
                  Upload Drawings / Hand-Drawn Sketches
                  <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
                </label>
                {uploadedPlan ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/7 px-4 py-3 text-sm text-white/75">
                    <Sparkles size={16} className="text-[#ff975b]" />
                    {uploadedPlan.name || 'Custom upload ready'}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onGenerate}
                disabled={isParsing}
                className="inline-flex items-center justify-center gap-3 rounded-[18px] bg-gradient-to-b from-[#d96a10] to-[#b65205] px-10 py-5 text-2xl font-bold text-white shadow-[0_12px_24px_rgba(191,95,13,0.4)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-65"
              >
                <Sparkles size={22} />
                {isParsing ? 'Generating...' : 'Generate'}
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {Object.values(samplePlans).map((plan) => {
                const isActive = selectedPlan === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => onSelectPlan(plan.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${isActive ? 'bg-[#ff975b] text-[#1f2433]' : 'border border-white/12 bg-white/6 text-white/78 hover:bg-white/10'}`}
                  >
                    Plan {plan.id}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusPill({ label, value }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
      <span className="text-white/45">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

function ModeSelector({ title, description, value, onChange, options }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#313747]/62 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{title}</p>
      <p className="mt-2 min-h-[42px] text-sm leading-6 text-[#c5cbda]">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-[#ff975b] text-[#1f2433]' : 'border border-white/12 bg-white/6 text-white/78 hover:bg-white/10'}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BackendCard({ backendStatus }) {
  const isOnline = backendStatus?.state === 'online';
  const isChecking = backendStatus?.state === 'checking';
  const llmReady = Boolean(backendStatus?.llm?.configured);

  return (
    <div className="rounded-[24px] border border-white/10 bg-[#313747]/62 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.22em] text-white/45">Backend Status</p>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${isChecking ? 'bg-white/10 text-white/70' : isOnline ? 'bg-[#d8ff52]/16 text-[#d8ff52]' : 'bg-[#ff975b]/16 text-[#ffb48c]'}`}>
          {isChecking ? 'Checking' : isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm text-[#c5cbda]">
        <p>{isOnline ? 'FastAPI pipeline is reachable from the frontend.' : backendStatus?.error || 'The app will fall back to the in-browser pipeline when the backend is unavailable.'}</p>
        <p className="text-white/65">LLM: {llmReady ? `${backendStatus.llm.provider}${backendStatus.llm.model ? ` - ${backendStatus.llm.model}` : ''}` : 'Template fallback only'}</p>
      </div>
    </div>
  );
}
