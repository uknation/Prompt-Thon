export default function MetricCard({ label, value, hint, accent = 'text-lime' }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-glow">
      <p className="text-xs uppercase tracking-[0.24em] text-fog">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${accent}`}>{value}</p>
      {hint ? <p className="mt-2 text-sm text-fog">{hint}</p> : null}
    </div>
  );
}
