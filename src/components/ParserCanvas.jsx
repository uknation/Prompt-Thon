import { useEffect, useRef, useState } from 'react';

const HANDLE_SIZE = 14;
const MIN_SHELL_SIZE = 80;

export default function ParserCanvas({ parsed, layers, planPreview, editableShell, onUpdateShellRect }) {
  const ref = useRef(null);
  const previewImageRef = useRef(null);
  const interactionRef = useRef(null);
  const [cursor, setCursor] = useState('default');

  useEffect(() => {
    if (!planPreview) {
      previewImageRef.current = null;
      return undefined;
    }

    const image = new Image();
    image.onload = () => {
      previewImageRef.current = image;
      drawCanvas();
    };
    image.src = planPreview;

    return () => {
      previewImageRef.current = null;
    };
  }, [planPreview]);

  useEffect(() => {
    drawCanvas();
  }, [parsed, layers, editableShell]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !editableShell || !onUpdateShellRect) return undefined;

    const onMouseDown = (event) => {
      const point = toCanvasPoint(canvas, event);
      const mode = getInteractionMode(point, editableShell);
      if (!mode) return;

      interactionRef.current = {
        mode,
        startPoint: point,
        startShell: { ...editableShell },
      };
    };

    const onMouseMove = (event) => {
      const point = toCanvasPoint(canvas, event);
      const active = interactionRef.current;

      if (!active) {
        setCursor(cursorForMode(getInteractionMode(point, editableShell)));
        return;
      }

      event.preventDefault();
      const dx = point.x - active.startPoint.x;
      const dy = point.y - active.startPoint.y;
      const nextShell = getAdjustedShell(active.startShell, active.mode, dx, dy, canvas.width, canvas.height);
      onUpdateShellRect(nextShell);
    };

    const onMouseUp = () => {
      interactionRef.current = null;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [editableShell, onUpdateShellRect]);

  function drawCanvas() {
    const canvas = ref.current;
    if (!canvas || !parsed) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const isCustomPlan = parsed.plan?.id === 'CUSTOM';

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#091120';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let x = 0; x < width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const preview = previewImageRef.current;
    if (preview) drawPreviewImage(ctx, preview, width, height, isCustomPlan);
    drawOverlay(ctx, isCustomPlan, height);
    if (editableShell) drawCropShell(ctx, editableShell);
  }

  function drawPreviewImage(ctx, img, width, height, isCustomPlan) {
    const scale = Math.min(width / img.width, height / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    ctx.globalAlpha = isCustomPlan ? 0.88 : 0.15;
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    ctx.globalAlpha = 1;

    if (isCustomPlan) {
      ctx.fillStyle = 'rgba(9, 17, 32, 0.18)';
      ctx.fillRect(offsetX, offsetY, drawWidth, drawHeight);
    }
  }

  function drawOverlay(ctx, isCustomPlan, height) {
    if (layers.rooms) {
      parsed.rooms.forEach((room) => {
        ctx.fillStyle = isCustomPlan ? 'rgba(75, 233, 212, 0.08)' : room.color;
        ctx.fillRect(room.x, room.y, room.w, room.h);
        if (layers.labels) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.font = '12px Segoe UI';
          ctx.textAlign = 'center';
          ctx.fillText(room.name, room.x + room.w / 2, room.y + room.h / 2);
        }
      });
    }

    if (layers.walls) {
      parsed.walls.forEach((wall) => {
        ctx.strokeStyle = wall.type === 'load-bearing' ? '#ff7a59' : '#4be9d4';
        ctx.lineWidth = wall.type === 'load-bearing' ? (isCustomPlan ? 3.2 : 5) : (isCustomPlan ? 2 : 2.5);
        ctx.beginPath();
        ctx.moveTo(wall.x1, wall.y1);
        ctx.lineTo(wall.x2, wall.y2);
        ctx.stroke();
      });
    }

    if (layers.openings) {
      parsed.openings.forEach((opening) => {
        ctx.fillStyle = opening.type === 'window' ? '#4be9d4' : '#d8ff52';
        ctx.beginPath();
        ctx.arc(opening.x, opening.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '11px Consolas';
    ctx.textAlign = 'left';
    ctx.fillText(isCustomPlan ? 'Drag the shell box to crop and fit the plan' : 'Scale: 1cm = 0.4m', 12, height - 12);
  }

  function drawCropShell(ctx, shell) {
    ctx.save();
    ctx.fillStyle = 'rgba(216, 255, 82, 0.08)';
    ctx.fillRect(shell.x, shell.y, shell.w, shell.h);
    ctx.strokeStyle = '#d8ff52';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(shell.x, shell.y, shell.w, shell.h);
    ctx.setLineDash([]);

    for (const handle of getHandles(shell)) {
      ctx.fillStyle = '#d8ff52';
      ctx.fillRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeStyle = '#091120';
      ctx.lineWidth = 1;
      ctx.strokeRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    }
    ctx.restore();
  }

  return <canvas ref={ref} width={680} height={460} className="w-full rounded-3xl border border-white/10 bg-ink" style={{ cursor }} />;
}

function toCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function getHandles(shell) {
  return [
    { key: 'nw', x: shell.x, y: shell.y },
    { key: 'ne', x: shell.x + shell.w, y: shell.y },
    { key: 'sw', x: shell.x, y: shell.y + shell.h },
    { key: 'se', x: shell.x + shell.w, y: shell.y + shell.h },
  ];
}

function getInteractionMode(point, shell) {
  const handle = getHandles(shell).find((item) => Math.abs(point.x - item.x) <= HANDLE_SIZE && Math.abs(point.y - item.y) <= HANDLE_SIZE);
  if (handle) return handle.key;

  const inside = point.x >= shell.x && point.x <= shell.x + shell.w && point.y >= shell.y && point.y <= shell.y + shell.h;
  return inside ? 'move' : null;
}

function cursorForMode(mode) {
  if (!mode) return 'default';
  if (mode === 'move') return 'move';
  if (mode === 'nw' || mode === 'se') return 'nwse-resize';
  if (mode === 'ne' || mode === 'sw') return 'nesw-resize';
  return 'default';
}

function getAdjustedShell(shell, mode, dx, dy, maxWidth, maxHeight) {
  let nextX = shell.x;
  let nextY = shell.y;
  let nextW = shell.w;
  let nextH = shell.h;

  if (mode === 'move') {
    nextX += dx;
    nextY += dy;
  }
  if (mode.includes('n')) {
    nextY += dy;
    nextH -= dy;
  }
  if (mode.includes('s')) {
    nextH += dy;
  }
  if (mode.includes('w')) {
    nextX += dx;
    nextW -= dx;
  }
  if (mode.includes('e')) {
    nextW += dx;
  }

  nextW = Math.max(MIN_SHELL_SIZE, nextW);
  nextH = Math.max(MIN_SHELL_SIZE, nextH);
  nextX = Math.max(0, Math.min(maxWidth - nextW, nextX));
  nextY = Math.max(0, Math.min(maxHeight - nextH, nextY));

  if (mode.includes('n') && nextY === 0) nextH = shell.y + shell.h;
  if (mode.includes('w') && nextX === 0) nextW = shell.x + shell.w;
  if (mode.includes('e')) nextW = Math.min(nextW, maxWidth - nextX);
  if (mode.includes('s')) nextH = Math.min(nextH, maxHeight - nextY);

  return {
    x: Math.round(nextX),
    y: Math.round(nextY),
    w: Math.round(nextW),
    h: Math.round(nextH),
  };
}
