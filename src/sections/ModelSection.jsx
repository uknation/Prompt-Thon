import StageCard from '../components/StageCard';
import MetricCard from '../components/MetricCard';
import ModelViewer from '../components/ModelViewer';

export default function ModelSection({ controls, onToggleControl, geometry, modelStats }) {
  return (
    <StageCard
      eyebrow="Stage 3"
      title="3D Model Generator"
      subtitle="A live Three.js scene extrudes the reconstructed shell into a massing model with layer controls. This gives the user immediate spatial validation before choosing structural materials."
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {Object.keys(controls).map((control) => (
            <button
              key={control}
              type="button"
              onClick={() => onToggleControl(control)}
              className={`rounded-full px-4 py-2 text-sm ${controls[control] ? 'bg-lime text-ink' : 'border border-white/15 bg-white/5 text-fog'}`}
            >
              {control}
            </button>
          ))}
        </div>

        <ModelViewer geometry={geometry} controls={controls} />

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Mesh count" value={modelStats?.meshCount ?? '-'} accent="text-aqua" />
          <MetricCard label="Floor height" value={modelStats ? `${modelStats.floorHeight}m` : '-'} />
          <MetricCard label="Volume" value={modelStats ? `${modelStats.volume} m3` : '-'} accent="text-coral" />
          <MetricCard label="Vertices" value={modelStats?.vertexEstimate ?? '-'} accent="text-lime" />
        </div>
      </div>
    </StageCard>
  );
}
