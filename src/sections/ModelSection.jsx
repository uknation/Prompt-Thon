import { Suspense, lazy } from 'react';
import StageCard from '../components/StageCard';
import MetricCard from '../components/MetricCard';
import EmptyStageState from '../components/EmptyStageState';

const ModelViewer = lazy(() => import('../components/ModelViewer'));

export default function ModelSection({ controls, onToggleControl, geometry, modelStats }) {
  return (
    <StageCard
      eyebrow="Stage 3"
      title="3D Model Generator"
      subtitle="A live Three.js scene extrudes the reconstructed shell into a massing model with layer controls. This gives the user immediate spatial validation before choosing structural materials."
    >
      {!geometry ? (
        <EmptyStageState
          title="3D Viewer Waiting"
          description="As soon as a valid plan shell and wall network are available, the viewer will load the 3D preview here with doors, windows, rotation controls, and a live compass."
          hint="The 3D module now loads on demand for a lighter app shell"
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {Object.keys(controls).map((control) => (
              <button
                key={control}
                type="button"
                onClick={() => onToggleControl(control)}
                className={`rounded-full px-4 py-2 text-sm ${controls[control] ? 'bg-lime text-ink' : 'border border-white/15 bg-white/5 text-fog'}`}
              >
                {formatControlLabel(control)}
              </button>
            ))}
          </div>

          <Suspense fallback={<ViewerLoadingState />}>
            <ModelViewer geometry={geometry} controls={controls} />
          </Suspense>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Mesh count" value={modelStats?.meshCount ?? '-'} accent="text-aqua" />
            <MetricCard label="Floor height" value={modelStats ? `${modelStats.floorHeight}m` : '-'} />
            <MetricCard label="Volume" value={modelStats ? `${modelStats.volume} m3` : '-'} accent="text-coral" />
            <MetricCard label="Vertices" value={modelStats?.vertexEstimate ?? '-'} accent="text-lime" />
          </div>
        </div>
      )}
    </StageCard>
  );
}

function ViewerLoadingState() {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-3xl border border-white/10 bg-ink">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-aqua">Loading 3D Viewer</p>
        <p className="mt-3 text-sm text-fog">Preparing the interactive model and scene assets.</p>
      </div>
    </div>
  );
}

function formatControlLabel(control) {
  return control
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase());
}
