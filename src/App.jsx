import { useEffect, useMemo, useState } from 'react';
import UploadPanel from './components/UploadPanel';
import PipelineViewer from './components/PipelineViewer';
import ParsingCanvas from './components/ParsingCanvas';
import GeometryViewer from './components/GeometryViewer';
import ThreeStageViewer from './components/ThreeStageViewer';
import MaterialPanel from './components/MaterialPanel';
import ExplanationPanel from './components/ExplanationPanel';
import { samplePlans } from './data/plans';
import { fetchBackendHealth, runImagePipeline, runPlanPipeline } from './lib/api';

const initialBackendStatus = {
  ok: false,
  error: '',
  pipeline: { stages: [], samples: [] },
};

export default function App() {
  const [selectedPlanId, setSelectedPlanId] = useState('B');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [result, setResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [backendStatus, setBackendStatus] = useState(initialBackendStatus);
  const [error, setError] = useState('');

  const sampleOptions = useMemo(
    () => Object.entries(samplePlans).map(([id, plan]) => ({ id, name: plan.name })),
    [],
  );

  const stageOutputs = result?.stage_outputs || null;
  const selectedPlan = samplePlans[selectedPlanId];

  useEffect(() => {
    let active = true;

    const loadHealth = async () => {
      const health = await fetchBackendHealth();
      if (!active) return;
      setBackendStatus(health);
    };

    loadHealth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!uploadedFile) {
      setUploadPreview('');
      return undefined;
    }

    const nextUrl = URL.createObjectURL(uploadedFile);
    setUploadPreview(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [uploadedFile]);

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError('');
    setUploadedFile(file);
  };

  const handleClearUpload = () => {
    setUploadedFile(null);
    setResult(null);
    setError('');
  };

  const handleRun = async () => {
    setError('');
    setIsRunning(true);

    try {
      const nextResult = uploadedFile
        ? await runImagePipeline(uploadedFile)
        : await runPlanPipeline(selectedPlan);
      setResult(nextResult);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Pipeline execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleDownloadTrace = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'autonomous-structural-trace.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),transparent_24%),linear-gradient(160deg,#020617_0%,#050b16_45%,#0f172a_100%)] px-4 py-5 text-white md:px-6 xl:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <UploadPanel
          sampleOptions={sampleOptions}
          selectedPlanId={selectedPlanId}
          onSelectPlan={setSelectedPlanId}
          uploadedFile={uploadedFile}
          uploadPreview={uploadPreview}
          onUpload={handleUpload}
          onClearUpload={handleClearUpload}
          onRun={handleRun}
          isRunning={isRunning}
          backendStatus={backendStatus}
        />

        {error ? (
          <div className="rounded-[24px] border border-rose-400/25 bg-rose-400/10 px-5 py-4 text-sm leading-7 text-rose-100">
            {error}
          </div>
        ) : null}

        <PipelineViewer result={result} onDownloadTrace={handleDownloadTrace} />

        <div className="grid gap-6 xl:grid-cols-2">
          <StageSection
            eyebrow="Stage 1"
            title="Parsing Contract"
            description={stageOutputs?.parsing
              ? `${stageOutputs.parsing.walls.length} walls, ${stageOutputs.parsing.openings.length} openings, confidence ${stageOutputs.parsing.confidence.toFixed(2)}`
              : 'Structured parser output only. Later stages never read the raw image.'}
          >
            <ParsingCanvas parsing={stageOutputs?.parsing} />
          </StageSection>

          <StageSection
            eyebrow="Stage 2"
            title="Geometry + Structural Reasoning"
            description={stageOutputs?.geometry
              ? `${stageOutputs.geometry.nodes.length} nodes, ${stageOutputs.geometry.edges.length} edges, ${stageOutputs.geometry.rooms.length} rooms, ${stageOutputs.geometry.openings?.length || 0} openings`
              : 'Validation snaps points, repairs near misses, and reconstructs a topological graph.'}
          >
            <GeometryViewer geometry={stageOutputs?.geometry} />
          </StageSection>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <StageSection
            eyebrow="Stage 3"
            title="3D Output"
            description={stageOutputs?.model3d
              ? `${stageOutputs.model3d.elements.length} 3D elements including ${stageOutputs.model3d.elements.filter((item) => item.type === 'door').length} doors and ${stageOutputs.model3d.elements.filter((item) => item.type === 'window').length} windows`
              : '3D generation consumes only the geometry contract and emits wall/floor element payloads.'}
          >
            <ThreeStageViewer model3d={stageOutputs?.model3d} />
          </StageSection>

          <div className="space-y-6">
            <StageSection
              eyebrow="Stage 4"
              title="Material Reasoning"
              description={stageOutputs?.materials
                ? `${stageOutputs.materials.results.length} element-level material decisions`
                : 'Load-bearing walls prioritize strength; partitions prioritize cost.'}
            >
              <MaterialPanel materials={stageOutputs?.materials} />
            </StageSection>

            <StageSection
              eyebrow="Stage 5"
              title="Explainability"
              description={stageOutputs?.explainability
                ? `${stageOutputs.explainability.results.length} explanations referencing wall type and span`
                : 'Every recommendation is explained in structural terms, not only scores.'}
            >
              <ExplanationPanel explainability={stageOutputs?.explainability} />
            </StageSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageSection({ eyebrow, title, description, children }) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-300">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}
