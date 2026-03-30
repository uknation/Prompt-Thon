export default function EmptyStageState({ title, description, hint }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.03] px-6 py-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-aqua">{title}</p>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-fog">{description}</p>
      {hint ? <p className="mt-4 text-xs uppercase tracking-[0.22em] text-white/45">{hint}</p> : null}
    </div>
  );
}
