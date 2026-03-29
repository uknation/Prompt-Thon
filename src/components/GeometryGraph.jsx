import { useEffect, useRef } from 'react';

export default function GeometryGraph({ geometry }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !geometry) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#091120';
    ctx.fillRect(0, 0, width, height);

    geometry.walls.forEach((wall) => {
      ctx.strokeStyle = wall.type === 'load-bearing' ? 'rgba(255,122,89,0.45)' : 'rgba(75,233,212,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wall.x1 * 0.9 + 20, wall.y1 * 0.7 + 20);
      ctx.lineTo(wall.x2 * 0.9 + 20, wall.y2 * 0.7 + 20);
      ctx.stroke();
    });

    geometry.junctions.forEach((junction) => {
      ctx.fillStyle = '#d8ff52';
      ctx.beginPath();
      ctx.arc(junction.x * 0.9 + 20, junction.y * 0.7 + 20, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px Consolas';
    ctx.fillText(`Nodes: ${geometry.junctions.length} | Edges: ${geometry.walls.length}`, 14, height - 12);
  }, [geometry]);

  return <canvas ref={ref} width={680} height={320} className="w-full rounded-3xl border border-white/10 bg-ink" />;
}
