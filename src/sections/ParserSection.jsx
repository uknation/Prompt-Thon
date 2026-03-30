import { Building2, FileImage, ScanLine, Upload } from 'lucide-react';
import StageCard from '../components/StageCard';
import ParserCanvas from '../components/ParserCanvas';
import { samplePlans } from '../data/plans';

export default function ParserSection({
  selectedPlan,
  onSelectPlan,
  onStart,
  onUpload,
  uploadedPlan,
  progress,
  isParsing,
  layers,
  onToggleLayer,
  parsed,
  planPreview,
  onUpdateShellRect,
}) {
  const shell = parsed?.plan?.outerWalls?.[0];
  const activePlan = parsed?.plan || samplePlans[selectedPlan];
  const segmentation = activePlan?.segmentation;
  const layerOrder = ['walls', 'rooms', 'openings', 'labels', 'segmentation'];
  const parserStats = [
    { label: 'Area', value: activePlan?.planArea ? `${activePlan.planArea} m2` : '-' },
    { label: 'Rooms', value: parsed?.rooms?.length ?? 0 },
    { label: 'Openings', value: parsed?.openings?.length ?? 0 },
    { label: 'Input', value: activePlan?.id === 'CUSTOM' ? 'Upload' : `Plan ${activePlan?.id ?? selectedPlan}` },
  ];

  return (
    <StageCard
      eyebrow="Stage 1"
      title="Floor Plan Parser"
      subtitle="Select a sample project from the problem statement or upload a custom image. The frontend simulates the parser state machine and converts the selected plan into structured walls, rooms, and openings."
      actions={(
        <>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10">
            <Upload size={16} />
            Upload Image
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          </label>
          <button
            type="button"
            onClick={onStart}
            disabled={isParsing}
            className="inline-flex items-center gap-2 rounded-full border border-aqua/40 bg-aqua/10 px-4 py-2 text-sm font-medium text-aqua transition hover:bg-aqua/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ScanLine size={16} />
            {isParsing ? 'Parsing...' : 'Parse Now'}
          </button>
        </>
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          {Object.values(samplePlans).map((plan) => {
            const isActive = selectedPlan === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => onSelectPlan(plan.id)}
                className={`w-full rounded-3xl border p-4 text-left transition ${isActive ? 'border-lime bg-lime/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{plan.name}</p>
                    <p className="mt-2 text-sm text-fog">{plan.description}</p>
                  </div>
                  <Building2 className="text-aqua" size={18} />
                </div>
              </button>
            );
          })}

          {uploadedPlan ? (
            <div className="rounded-3xl border border-aqua/30 bg-aqua/10 p-4">
              <p className="flex items-center gap-2 font-medium text-aqua">
                <FileImage size={16} />
                Custom image loaded
              </p>
              <p className="mt-2 text-sm text-fog">
                The uploaded image now drives custom shell reconstruction plus wall, door, and window segmentation overlays when parser detections are available.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {parserStats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-fog">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between text-sm text-fog">
              <span>Parser progress</span>
              <span>{progress.pct}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-gradient-to-r from-aqua to-lime transition-all duration-300" style={{ width: `${progress.pct}%` }} />
            </div>
            <p className="mt-3 text-sm text-fog">
              {isParsing ? progress.label : parsed ? 'Parsed dataset ready for downstream stages.' : 'No parser run yet.'}
            </p>
          </div>

          {activePlan?.purpose ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-fog">Evaluation purpose</p>
              <p className="mt-2 text-sm leading-7 text-fog">{activePlan.purpose}</p>
            </div>
          ) : null}

          {segmentation ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-fog">Detected elements</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <DetectionChip label="Wall regions" value={segmentation.walls?.length ?? 0} tone="coral" />
                <DetectionChip label="Wall lines" value={segmentation.wallLines?.length ?? 0} tone="amber" />
                <DetectionChip label="Windows" value={segmentation.windows?.length ?? 0} tone="aqua" />
                <DetectionChip label="Doors" value={segmentation.doors?.length ?? 0} tone="lime" />
              </div>
            </div>
          ) : null}

          {shell ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-fog">Mouse Edit</p>
              <p className="mt-2 text-sm text-fog">Use the crop box on the canvas to move and resize the detected floor-plan boundary.</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {layerOrder.map((layer) => (
              <button
                key={layer}
                type="button"
                onClick={() => onToggleLayer(layer)}
                className={`rounded-full px-4 py-2 text-sm ${layers[layer] ? 'bg-white text-ink' : 'border border-white/15 bg-white/5 text-fog'}`}
              >
                {formatLayerLabel(layer)}
              </button>
            ))}
          </div>
          <ParserCanvas parsed={parsed} layers={layers} planPreview={planPreview} editableShell={shell} onUpdateShellRect={onUpdateShellRect} />
        </div>
      </div>
    </StageCard>
  );
}

function DetectionChip({ label, value, tone }) {
  const toneMap = {
    coral: 'border-coral/20 bg-coral/10 text-coral',
    amber: 'border-[#ffb36b]/20 bg-[#ffb36b]/10 text-[#ffb36b]',
    aqua: 'border-aqua/20 bg-aqua/10 text-aqua',
    lime: 'border-lime/20 bg-lime/10 text-lime',
  };

  return (
    <div className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] ${toneMap[tone] || 'border-white/10 bg-white/5 text-white'}`}>
      {label}: {value}
    </div>
  );
}

function formatLayerLabel(layer) {
  return layer.charAt(0).toUpperCase() + layer.slice(1);
}
