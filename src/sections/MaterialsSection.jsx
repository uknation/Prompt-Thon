import { Layers3 } from 'lucide-react';
import StageCard from '../components/StageCard';
import MetricCard from '../components/MetricCard';
import { formatCurrencyLakh } from '../lib/format';

export default function MaterialsSection({ materialAnalysis }) {
  return (
    <StageCard
      eyebrow="Stage 4"
      title="Material Analysis"
      subtitle="The recommendation engine ranks practical material systems using strength, durability, cost, and embodied-carbon signals. The scoring is intentionally transparent so the product remains explainable."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {materialAnalysis?.recommendations.map((section) => (
            <div key={section.title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                  <p className="text-sm text-fog">{section.count} elements assessed</p>
                </div>
                <Layers3 className="text-aqua" size={18} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {section.ranked.slice(0, 3).map((material, index) => (
                  <div key={material.name} className={`rounded-2xl border p-4 ${index === 0 ? 'border-lime bg-lime/10' : 'border-white/10 bg-panelSoft/30'}`}>
                    <p className="font-semibold text-white">{material.name}</p>
                    <p className="mt-2 text-sm text-fog">Score {material.score}</p>
                    <p className="mt-3 text-sm text-fog">Best use: {material.bestUse}</p>
                    <div className="mt-4 space-y-2 text-xs text-fog">
                      <p>Strength: {material.strength}/5</p>
                      <p>Durability: {material.durability}/5</p>
                      <p>Cost: {material.cost}/5</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <MetricCard label="Total cost" value={materialAnalysis ? formatCurrencyLakh(materialAnalysis.summary.totalCostLakh) : '-'} accent="text-coral" hint="Structural package estimate" />
          <MetricCard label="Embodied carbon" value={materialAnalysis ? `${materialAnalysis.summary.embodiedCarbon} tCO2e` : '-'} accent="text-aqua" />
          <MetricCard label="Resilience" value={materialAnalysis?.summary.resilience ?? '-'} accent="text-lime" />
          <MetricCard label="Cost efficiency" value={materialAnalysis?.summary.costEfficiency ?? '-'} hint="Higher is better" />
        </div>
      </div>
    </StageCard>
  );
}
