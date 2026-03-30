import { useEffect, useRef } from 'react';

export default function GeometryGraph({ geometry }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !geometry) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const bounds = getBounds(geometry);
    const padding = 24;
    const spanX = Math.max(1, bounds.maxX - bounds.minX);
    const spanY = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);

    const toCanvasX = (x) => padding + (x - bounds.minX) * scale;
    const toCanvasY = (y) => padding + (y - bounds.minY) * scale;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#091120';
    ctx.fillRect(0, 0, width, height);

    geometry.walls.forEach((wall) => {
      ctx.strokeStyle = wall.type === 'load-bearing' ? 'rgba(255,122,89,0.45)' : 'rgba(75,233,212,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(wall.x1), toCanvasY(wall.y1));
      ctx.lineTo(toCanvasX(wall.x2), toCanvasY(wall.y2));
      ctx.stroke();
    });

    geometry.junctions.forEach((junction) => {
      ctx.fillStyle = '#d8ff52';
      ctx.beginPath();
      ctx.arc(toCanvasX(junction.x), toCanvasY(junction.y), 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px Consolas';
    ctx.fillText(`Nodes: ${geometry.junctions.length} | Edges: ${geometry.walls.length}`, 14, height - 12);
  }, [geometry]);

  return <canvas ref={ref} width={680} height={320} className="w-full rounded-3xl border border-white/10 bg-ink" />;
}

function getBounds(geometry) {
  const walls = geometry?.walls ?? [];
  return walls.reduce((acc, wall) => ({
    minX: Math.min(acc.minX, wall.x1, wall.x2),
    minY: Math.min(acc.minY, wall.y1, wall.y2),
    maxX: Math.max(acc.maxX, wall.x1, wall.x2),
    maxY: Math.max(acc.maxY, wall.y1, wall.y2),
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });
}
