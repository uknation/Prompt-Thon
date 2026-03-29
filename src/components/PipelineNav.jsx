import { cn } from '../lib/format';

export default function PipelineNav({ stages, currentStage, completedStage, onSelect }) {
  return (
    <div className="overflow-x-auto border-y border-white/10 bg-panel/70 backdrop-blur">
      <div className="flex min-w-max items-stretch">
        {stages.map((stage, index) => {
          const isActive = currentStage === index;
          const isDone = completedStage > index;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelect(index)}
              className={cn(
                'group flex min-w-[180px] items-center gap-4 border-r border-white/10 px-5 py-4 text-left transition',
                isActive ? 'bg-white/5 text-white' : 'text-fog hover:bg-white/5 hover:text-white',
              )}
            >
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold',
                isDone ? 'border-lime bg-lime text-ink' : isActive ? 'border-aqua bg-aqua/15 text-aqua' : 'border-white/15 text-fog',
              )}>
                {index + 1}
              </div>
              <div>
                <p className="font-semibold">{stage.label}</p>
                <p className="text-xs text-fog">{stage.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
