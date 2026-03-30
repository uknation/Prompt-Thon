const WIDTH = 560;
const HEIGHT = 360;
const PADDING = 24;

export default function ParsingCanvas({ parsing }) {
  if (!parsing) {
    return <EmptyState message="Run the pipeline to visualize the parsing contract output." />;
  }

  const rawContours = parsing.rawContours || parsing.raw_contours || [];

  const bounds = getBounds(parsing);
  const scale = Math.min(
    (WIDTH - PADDING * 2) / Math.max(bounds.maxX - bounds.minX, 1),
    (HEIGHT - PADDING * 2) / Math.max(bounds.maxY - bounds.minY, 1),
  );

  const projectX = (x) => PADDING + (x - bounds.minX) * scale;
  const projectY = (y) => HEIGHT - PADDING - (y - bounds.minY) * scale;

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full">
        <rect width={WIDTH} height={HEIGHT} fill="#020617" />
        <Grid />

        {rawContours.map((contour) => (
          <polyline
            key={`contour-${contour.id}`}
            points={contour.points.map((point) => `${projectX(point[0])},${projectY(point[1])}`).join(' ')}
            fill={contour.label === 'outer-shell' ? 'rgba(251,191,36,0.06)' : 'rgba(56,189,248,0.04)'}
            stroke={contour.label === 'outer-shell' ? 'rgba(251,191,36,0.35)' : 'rgba(56,189,248,0.2)'}
            strokeWidth="1.5"
          />
        ))}

        {parsing.walls.map((wall) => (
          <line
            key={`wall-${wall.id}`}
            x1={projectX(wall.x1)}
            y1={projectY(wall.y1)}
            x2={projectX(wall.x2)}
            y2={projectY(wall.y2)}
            stroke="#f59e0b"
            strokeWidth={Math.max(2, wall.thickness * 9)}
            strokeLinecap="round"
          />
        ))}

        {parsing.openings.map((opening) => (
          <OpeningGlyph key={`opening-${opening.id}`} opening={opening} projectX={projectX} projectY={projectY} scale={scale} />
        ))}
      </svg>
    </div>
  );
}

function OpeningGlyph({ opening, projectX, projectY, scale }) {
  const orientation = opening.hostOrientation || opening.host_orientation || 'horizontal';
  const family = String(opening.type).includes('window') ? 'window' : 'door';
  const halfSpan = (opening.width * scale) / 2;
  const x = projectX(opening.x);
  const y = projectY(opening.y);
  const stroke = family === 'window' ? '#38bdf8' : '#34d399';
  const label = family === 'window' ? 'W' : 'D';

  if (orientation === 'horizontal') {
    return (
      <g>
        <line x1={x - halfSpan} y1={y} x2={x + halfSpan} y2={y} stroke={stroke} strokeWidth="6" strokeLinecap="round" />
        <text x={x + 8} y={y - 8} fill="#cbd5e1" fontSize="11">
          {label}
        </text>
      </g>
    );
  }

  return (
    <g>
      <line x1={x} y1={y - halfSpan} x2={x} y2={y + halfSpan} stroke={stroke} strokeWidth="6" strokeLinecap="round" />
      <text x={x + 8} y={y - 8} fill="#cbd5e1" fontSize="11">
        {label}
      </text>
    </g>
  );
}

function Grid() {
  const lines = [];
  for (let x = 40; x < WIDTH; x += 40) {
    lines.push(<line key={`vx-${x}`} x1={x} y1="0" x2={x} y2={HEIGHT} stroke="rgba(148,163,184,0.08)" />);
  }
  for (let y = 40; y < HEIGHT; y += 40) {
    lines.push(<line key={`hy-${y}`} x1="0" y1={y} x2={WIDTH} y2={y} stroke="rgba(148,163,184,0.08)" />);
  }
  return <g>{lines}</g>;
}

function getBounds(parsing) {
  const rawContours = parsing.rawContours || parsing.raw_contours || [];
  const points = [
    ...parsing.walls.flatMap((wall) => [
      [wall.x1, wall.y1],
      [wall.x2, wall.y2],
    ]),
    ...rawContours.flatMap((contour) => contour.points),
    ...parsing.openings.map((opening) => [opening.x, opening.y]),
  ];
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function EmptyState({ message }) {
  return (
    <div className="flex h-[360px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-slate-950/70 p-8 text-center text-sm leading-6 text-slate-400">
      {message}
    </div>
  );
}
