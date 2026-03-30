const WIDTH = 560;
const HEIGHT = 360;
const PADDING = 24;

export default function GeometryViewer({ geometry }) {
  if (!geometry) {
    return <EmptyState message="Geometry nodes, edges, and rooms will appear here after validation completes." />;
  }

  const bounds = getBounds(geometry);
  const scale = Math.min(
    (WIDTH - PADDING * 2) / Math.max(bounds.maxX - bounds.minX, 1),
    (HEIGHT - PADDING * 2) / Math.max(bounds.maxY - bounds.minY, 1),
  );

  const projectX = (x) => PADDING + (x - bounds.minX) * scale;
  const projectY = (y) => HEIGHT - PADDING - (y - bounds.minY) * scale;
  const nodeLookup = Object.fromEntries(geometry.nodes.map((node) => [node.id, node]));
  const openings = geometry.openings || [];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full">
          <rect width={WIDTH} height={HEIGHT} fill="#020617" />

          {geometry.rooms.map((room) => (
            <polygon
              key={`room-${room.id}`}
              points={room.boundary.map((point) => `${projectX(point[0])},${projectY(point[1])}`).join(' ')}
              fill="rgba(59,130,246,0.12)"
              stroke="rgba(96,165,250,0.2)"
              strokeWidth="1.5"
            />
          ))}

          {geometry.edges.map((edge) => {
            const start = nodeLookup[edge.start];
            const end = nodeLookup[edge.end];
            return (
              <line
                key={`edge-${edge.id}`}
                x1={projectX(start.x)}
                y1={projectY(start.y)}
                x2={projectX(end.x)}
                y2={projectY(end.y)}
                stroke={edge.type === 'load_bearing' ? '#f97316' : '#22c55e'}
                strokeWidth={edge.type === 'load_bearing' ? 4 : 2.8}
                strokeLinecap="round"
              />
            );
          })}

          {openings.map((opening) => (
            <GeometryOpeningGlyph
              key={`opening-${opening.id}`}
              opening={opening}
              projectX={projectX}
              projectY={projectY}
              scale={scale}
            />
          ))}

          {geometry.nodes.map((node) => (
            <g key={`node-${node.id}`}>
              <circle cx={projectX(node.x)} cy={projectY(node.y)} r="4" fill="#e2e8f0" />
              <text x={projectX(node.x) + 7} y={projectY(node.y) - 7} fill="#94a3b8" fontSize="11">
                N{node.id}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {geometry.wall_reasoning.slice(0, 8).map((item) => (
          <article key={item.wall_id} className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">Wall {item.wall_id}</p>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.wall_type === 'load_bearing' ? 'bg-orange-400/20 text-orange-100' : 'bg-emerald-400/20 text-emerald-100'}`}>
                {item.wall_type.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{item.reason}</p>
            <p className="mt-2 text-xs text-slate-400">
              Span {item.span.toFixed(2)}m | Length {item.length.toFixed(2)}m | Rooms {item.connected_room_ids.length}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function GeometryOpeningGlyph({ opening, projectX, projectY, scale }) {
  const orientation = opening.hostOrientation || opening.host_orientation || 'horizontal';
  const family = String(opening.type).includes('window') ? 'window' : 'door';
  const stroke = family === 'window' ? '#38bdf8' : '#22c55e';
  const halfSpan = (opening.width * scale) / 2;
  const x = projectX(opening.position[0]);
  const y = projectY(opening.position[1]);

  if (orientation === 'horizontal') {
    return <line x1={x - halfSpan} y1={y} x2={x + halfSpan} y2={y} stroke={stroke} strokeWidth="6" strokeLinecap="round" />;
  }
  return <line x1={x} y1={y - halfSpan} x2={x} y2={y + halfSpan} stroke={stroke} strokeWidth="6" strokeLinecap="round" />;
}

function getBounds(geometry) {
  const xs = [...geometry.nodes.map((node) => node.x), ...(geometry.openings || []).map((opening) => opening.position[0])];
  const ys = [...geometry.nodes.map((node) => node.y), ...(geometry.openings || []).map((opening) => opening.position[1])];
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
