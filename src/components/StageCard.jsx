export default function StageCard({ eyebrow, title, subtitle, actions, children }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-panel/80 p-6 shadow-glow backdrop-blur">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-aqua">{eyebrow}</p>
          <h2 className="mt-2 font-display text-3xl text-white">{title}</h2>
          {subtitle ? <p className="mt-2 max-w-3xl text-sm text-fog">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
