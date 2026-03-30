import StageCard from '../components/StageCard';
import MetricCard from '../components/MetricCard';
import GeometryGraph from '../components/GeometryGraph';
import EmptyStageState from '../components/EmptyStageState';

export default function GeometrySection({ geometry }) {
  return (
    <StageCard
      eyebrow="Stage 2"
      title="Geometry Reconstruction"
      subtitle="The parsed primitives are transformed into structural entities, room spans, shell efficiency, wall classes, and alert logic. This is the core engineering stage for downstream decision-making."
    >
      {!geometry ? (
        <EmptyStageState
          title="Geometry Waiting"
          description="Run the parser or select a plan first. Once the wall network is available, this stage will calculate spans, shell efficiency, and structural alerts automatically."
          hint="Stage 1 feeds Stage 2 automatically"
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Load-bearing" value={geometry.loadBearing.length} accent="text-coral" />
              <MetricCard label="Partition" value={geometry.partition.length} accent="text-aqua" />
              <MetricCard label="Max span" value={`${geometry.maxSpan}m`} accent="text-lime" />
              <MetricCard label="Efficiency" value={`${geometry.metrics.efficiency}%`} hint={`${geometry.metrics.roomCount} rooms reconstructed`} />
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/5 text-left text-fog">
                  <tr>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Area</th>
                    <th className="px-4 py-3">Perimeter</th>
                    <th className="px-4 py-3">Span</th>
                    <th className="px-4 py-3">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-panelSoft/40">
                  {geometry.rooms.map((room) => (
                    <tr key={room.name}>
                      <td className="px-4 py-3 font-medium text-white">{room.name}</td>
                      <td className="px-4 py-3 text-fog">{room.area} m2</td>
                      <td className="px-4 py-3 text-fog">{room.perimeter} m</td>
                      <td className="px-4 py-3 text-fog">{room.span} m</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${room.risk === 'span-risk' ? 'bg-coral/15 text-coral' : room.risk === 'large-program' ? 'bg-lime/10 text-lime' : 'bg-white/10 text-fog'}`}>
                          {room.risk.replace('-', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <GeometryGraph geometry={geometry} />
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-fog">Structural alerts</p>
              <div className="mt-3 space-y-3">
                {geometry.alerts.length ? geometry.alerts.map((alert) => (
                  <div key={alert} className="rounded-2xl border border-coral/20 bg-coral/10 p-3 text-sm text-coral">{alert}</div>
                )) : <p className="text-sm text-fog">No critical geometry issues flagged.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </StageCard>
  );
}
