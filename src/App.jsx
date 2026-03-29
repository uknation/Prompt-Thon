import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, RefreshCw, Sparkles } from 'lucide-react';
import PipelineNav from './components/PipelineNav';
import Sidebar from './components/Sidebar';
import { formatDate } from './lib/format';
import {
  analyzeUploadedPlan,
  STAGES,
  PARSER_STEPS,
  buildExplainabilityReport,
  buildGeometryModel,
  buildMaterialAnalysis,
  buildModelStats,
  buildParsedModel,
  getPlanFromSelection,
} from './lib/pipeline';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import ParserSection from './sections/ParserSection';
import GeometrySection from './sections/GeometrySection';
import ModelSection from './sections/ModelSection';
import MaterialsSection from './sections/MaterialsSection';
import ReportSection from './sections/ReportSection';

const STORAGE_KEY = 'structure-ai-runs';
const defaultLayers = { walls: true, rooms: true, openings: true, labels: true };
const defaultModelControls = { autoRotate: true, wireframe: false, walls: true, slab: true, roof: false, explode: false };
const idleProgress = { pct: 0, label: 'Idle' };

export default function App() {
  const stageRefs = useRef([]);
  const [selectedPlan, setSelectedPlan] = useState('B');
  const [uploadedPlan, setUploadedPlan] = useState(null);
  const [planDraft, setPlanDraft] = useState(() => clonePlan(getPlanFromSelection('B', null)));
  const [activeRun, setActiveRun] = useState(null);
  const [currentStage, setCurrentStage] = useState(0);
  const [completedStage, setCompletedStage] = useState(0);
  const [progress, setProgress] = useState(idleProgress);
  const [isParsing, setIsParsing] = useState(false);
  const [layers, setLayers] = useState(defaultLayers);
  const [modelControls, setModelControls] = useState(defaultModelControls);
  const [history, setHistory] = useLocalStorageState(STORAGE_KEY, []);

  const geometry = useMemo(() => (activeRun ? buildGeometryModel(activeRun.parsed) : null), [activeRun]);
  const modelStats = useMemo(() => (geometry ? buildModelStats(geometry) : null), [geometry]);
  const materialAnalysis = useMemo(() => (geometry ? buildMaterialAnalysis(geometry) : null), [geometry]);
  const previewParsed = useMemo(() => (planDraft ? buildParsedModel(planDraft) : null), [planDraft]);
  const report = useMemo(() => {
    if (!activeRun || !geometry || !materialAnalysis) return [];
    return buildExplainabilityReport(activeRun.plan, geometry, materialAnalysis);
  }, [activeRun, geometry, materialAnalysis]);

  useEffect(() => {
    setPlanDraft(clonePlan(getPlanFromSelection(selectedPlan, uploadedPlan)));
  }, [selectedPlan, uploadedPlan]);

  const handleRunPipeline = async (planId = selectedPlan) => {
    const plan = clonePlan(planDraft || getPlanFromSelection(planId, uploadedPlan));
    const parsed = buildParsedModel(plan);

    setIsParsing(true);
    setCurrentStage(0);
    setCompletedStage(0);

    for (const step of PARSER_STEPS) {
      setProgress(step);
      await new Promise((resolve) => setTimeout(resolve, 320));
    }

    const nextRun = {
      id: String(Date.now()),
      plan,
      parsed,
      uploadedPlan,
    };

    setActiveRun(nextRun);
    setCompletedStage(4);
    setCurrentStage(0);
    setIsParsing(false);
    setHistory((previousRuns) => [
      {
        id: nextRun.id,
        planName: plan.name,
        completedStage: 4,
        timestamp: formatDate(),
      },
      ...previousRuns,
    ].slice(0, 6));
  };

  const handleReset = () => {
    setActiveRun(null);
    setProgress(idleProgress);
    setCurrentStage(0);
    setCompletedStage(0);
    setLayers(defaultLayers);
    setModelControls(defaultModelControls);
    setUploadedPlan(null);
    setSelectedPlan('B');
    setPlanDraft(clonePlan(getPlanFromSelection('B', null)));
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      const image = new Image();
      image.onload = async () => {
        const nextUpload = {
          src,
          width: image.width,
          height: image.height,
          name: file.name,
        };
        const derivedPlan = await analyzeUploadedPlan(nextUpload);
        setUploadedPlan({
          ...nextUpload,
          derivedPlan,
        });
        setSelectedPlan('CUSTOM');
      };
      image.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleExportReport = () => {
    if (!activeRun || !materialAnalysis) return;

    const lines = [
      'STRUCTURE AI REPORT',
      `Plan: ${activeRun.plan.name}`,
      `Generated: ${formatDate()}`,
      '',
      ...report.flatMap((section) => [section.title, section.body, '']),
      'Top Materials:',
      ...materialAnalysis.topSelections.map((item) => `- ${item.section}: ${item.top.name} (score ${item.top.score})`),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const fileUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = 'structure-ai-report.txt';
    link.click();
    URL.revokeObjectURL(fileUrl);
  };

  const goToStage = (stageIndex) => {
    setCurrentStage(stageIndex);
    stageRefs.current[stageIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const setStageRef = (stageIndex) => (element) => {
    stageRefs.current[stageIndex] = element;
  };

  const toggleLayer = (layerName) => {
    setLayers((currentLayers) => ({
      ...currentLayers,
      [layerName]: !currentLayers[layerName],
    }));
  };

  const toggleModelControl = (controlName) => {
    setModelControls((currentControls) => ({
      ...currentControls,
      [controlName]: !currentControls[controlName],
    }));
  };

  const updateShell = (field, value) => {
    setPlanDraft((currentPlan) => {
      if (!currentPlan?.outerWalls?.length) return currentPlan;
      const numericValue = Number(value);
      const nextPlan = clonePlan(currentPlan);
      nextPlan.outerWalls[0][field] = Number.isFinite(numericValue) ? numericValue : nextPlan.outerWalls[0][field];
      return nextPlan;
    });
  };

  const updateShellRect = (nextShell) => {
    setPlanDraft((currentPlan) => {
      if (!currentPlan?.outerWalls?.length) return currentPlan;
      const nextPlan = clonePlan(currentPlan);
      nextPlan.outerWalls[0] = {
        ...nextPlan.outerWalls[0],
        ...nextShell,
      };
      return nextPlan;
    });
  };

  const updateRoom = (index, field, value) => {
    setPlanDraft((currentPlan) => {
      if (!currentPlan?.rooms?.[index]) return currentPlan;
      const nextPlan = clonePlan(currentPlan);
      if (field === 'name') {
        nextPlan.rooms[index][field] = value;
      } else {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) nextPlan.rooms[index][field] = numericValue;
      }
      return nextPlan;
    });
  };

  const addRoom = () => {
    setPlanDraft((currentPlan) => {
      if (!currentPlan?.outerWalls?.length) return currentPlan;
      const nextPlan = clonePlan(currentPlan);
      const shell = nextPlan.outerWalls[0];
      nextPlan.rooms.push({
        name: `Room ${nextPlan.rooms.length + 1}`,
        x: shell.x + 20,
        y: shell.y + 20,
        w: Math.max(72, Math.round(shell.w * 0.18)),
        h: Math.max(64, Math.round(shell.h * 0.18)),
        color: 'rgba(255,255,255,0.08)',
      });
      return nextPlan;
    });
  };

  const removeRoom = (index) => {
    setPlanDraft((currentPlan) => {
      if (!currentPlan?.rooms?.[index]) return currentPlan;
      const nextPlan = clonePlan(currentPlan);
      nextPlan.rooms.splice(index, 1);
      return nextPlan;
    });
  };

  return (
    <div className="min-h-screen px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="rounded-[32px] border border-white/10 bg-panel/70 p-6 shadow-glow backdrop-blur">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-lime">
                <Sparkles size={14} />
                Structural Intelligence System
              </div>
              <h1 className="mt-4 max-w-4xl font-display text-4xl leading-tight text-white md:text-6xl">
                Full 5-stage structural pipeline in React + Tailwind, built to feel like a real product.
              </h1>
              <p className="mt-4 max-w-3xl text-base text-fog md:text-lg">
                This app turns a floor-plan concept into parsed geometry, structural reconstruction, a live 3D model, material recommendations, and an explainability report. The CV and LLM seams are already shaped for production backend integration.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => handleRunPipeline(selectedPlan)} className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-3 font-semibold text-ink transition hover:scale-[1.01]">
                <Play size={18} />
                Run Full Pipeline
              </button>
              <button type="button" onClick={handleReset} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
                <RefreshCw size={18} />
                Reset
              </button>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-6">
            <PipelineNav stages={STAGES} currentStage={currentStage} completedStage={completedStage} onSelect={goToStage} />

            <section ref={setStageRef(0)} className="scroll-mt-6">
              <ParserSection
                selectedPlan={selectedPlan}
                onSelectPlan={setSelectedPlan}
                onStart={() => handleRunPipeline(selectedPlan)}
                onUpload={handleUpload}
                uploadedPlan={uploadedPlan}
                progress={progress}
                isParsing={isParsing}
                layers={layers}
                onToggleLayer={toggleLayer}
                parsed={previewParsed || activeRun?.parsed}
                planPreview={uploadedPlan?.src || activeRun?.plan.preview}
                planDraft={planDraft}
                onUpdateShell={updateShell}
                onUpdateShellRect={updateShellRect}
                onUpdateRoom={updateRoom}
                onAddRoom={addRoom}
                onRemoveRoom={removeRoom}
              />
            </section>

            <section ref={setStageRef(1)} className="scroll-mt-6">
              <GeometrySection geometry={geometry} />
            </section>

            <section ref={setStageRef(2)} className="scroll-mt-6">
              <ModelSection
                controls={modelControls}
                onToggleControl={toggleModelControl}
                geometry={geometry}
                modelStats={modelStats}
              />
            </section>

            <section ref={setStageRef(3)} className="scroll-mt-6">
              <MaterialsSection materialAnalysis={materialAnalysis} />
            </section>

            <section ref={setStageRef(4)} className="scroll-mt-6">
              <ReportSection report={report} onExport={handleExportReport} />
            </section>
          </main>

          <Sidebar run={activeRun} geometry={geometry} materialAnalysis={materialAnalysis} history={history} />
        </div>
      </div>
    </div>
  );
}

function clonePlan(plan) {
  return plan ? JSON.parse(JSON.stringify(plan)) : null;
}
