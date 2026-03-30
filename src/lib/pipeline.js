import { samplePlans } from '../data/plans';
import { materials } from '../data/materials';
import { requestServerPlanAnalysis } from './api';

export const STAGES = [
  { id: 0, label: 'Parser', subtitle: 'Floor-plan intelligence' },
  { id: 1, label: 'Geometry', subtitle: 'Structural reconstruction' },
  { id: 2, label: '3D Model', subtitle: 'Spatial build' },
  { id: 3, label: 'Materials', subtitle: 'Tradeoff engine' },
  { id: 4, label: 'Report', subtitle: 'Explainability layer' },
];

export const PARSER_STEPS = [
  { pct: 12, label: 'Normalizing plan image and extracting canvas extents' },
  { pct: 28, label: 'Running wall-line sweep and contour cleanup' },
  { pct: 44, label: 'Estimating closed rooms and junction topology' },
  { pct: 62, label: 'Classifying openings and adjacency' },
  { pct: 81, label: 'Computing labels, scale, and structural hints' },
  { pct: 100, label: 'Parser complete' },
];

export function getPlanFromSelection(planId, uploadedPlan) {
  const fallback = samplePlans.B;
  if (planId && samplePlans[planId]) return samplePlans[planId];
  if (uploadedPlan?.derivedPlan) return uploadedPlan.derivedPlan;
  if (uploadedPlan?.src) {
    return createCustomPlanFromUpload(uploadedPlan);
  }
  return fallback;
}

export async function analyzeUploadedPlan(uploadedPlan, file) {
  if (!uploadedPlan?.src) return null;

  if (file) {
    const serverAnalysis = await requestServerPlanAnalysis(file);
    if (serverAnalysis) {
      return createCustomPlanFromUpload({ ...uploadedPlan, analysis: serverAnalysis });
    }
  }

  const image = await loadImage(uploadedPlan.src);
  const analysis = inspectPlanImage(image);
  return createCustomPlanFromUpload({ ...uploadedPlan, analysis });
}

export function buildLocalPipelineRun(plan, prompt = '') {
  const parsed = buildParsedModel(plan);
  const geometry = buildGeometryModel(parsed);
  const modelStats = buildModelStats(geometry);
  const materialAnalysis = buildMaterialAnalysis(geometry);
  const report = buildExplainabilityReport(plan, geometry, materialAnalysis);

  return {
    plan,
    parsed,
    geometry,
    modelStats,
    materialAnalysis,
    report,
    prompt,
    reportMeta: {
      source: 'template',
      reason: 'local-pipeline',
      provider: 'Local rules',
      model: '',
      configured: false,
    },
    executionSource: 'local',
  };
}

function createCustomPlanFromUpload(uploadedPlan) {
  const canvasWidth = 680;
  const canvasHeight = 460;
  const padding = 56;
  const frameWidth = canvasWidth - padding * 2;
  const frameHeight = canvasHeight - padding * 2;
  const analysis = uploadedPlan.analysis;
  const box = analysis?.box || { x: 0.08, y: 0.08, w: 0.84, h: 0.84 };
  const imageRatio = uploadedPlan.width / uploadedPlan.height;

  let drawWidth = frameWidth;
  let drawHeight = drawWidth / imageRatio;
  if (drawHeight > frameHeight) {
    drawHeight = frameHeight;
    drawWidth = drawHeight * imageRatio;
  }

  const imageOffsetX = (canvasWidth - drawWidth) / 2;
  const imageOffsetY = (canvasHeight - drawHeight) / 2;
  const shellWidth = drawWidth * box.w;
  const shellHeight = drawHeight * box.h;
  const shellX = Math.round(imageOffsetX + drawWidth * box.x);
  const shellY = Math.round(imageOffsetY + drawHeight * box.y);
  const planArea = Math.max(75, Math.round((uploadedPlan.width * uploadedPlan.height) / 12000));
  const scale = Number(Math.sqrt(planArea / Math.max(shellWidth * shellHeight, 1)).toFixed(4));
  const canvasMetrics = {
    shellX,
    shellY,
    shellWidth,
    shellHeight,
    imageOffsetX,
    imageOffsetY,
    drawWidth,
    drawHeight,
  };
  const rooms = buildRoomsFromAnalysis(analysis, {
    ...canvasMetrics,
  });
  const segmentation = buildSegmentationFromAnalysis(analysis, canvasMetrics);
  const wallSegments = buildWallSegmentsFromAnalysis(segmentation, canvasMetrics, scale);
  const openings = buildOpeningsFromAnalysis(segmentation, canvasMetrics, scale);

  return {
    id: 'CUSTOM',
    name: uploadedPlan.name ? `Custom Uploaded Plan - ${uploadedPlan.name}` : 'Custom Uploaded Plan',
    description: 'User-specific geometry is generated from the uploaded floor-plan image bounds instead of reusing the sample layout.',
    preview: uploadedPlan.src,
    scale,
    planArea,
    outerWalls: [{ x: shellX, y: shellY, w: Math.round(shellWidth), h: Math.round(shellHeight) }],
    rooms,
    wallSegments,
    openings,
    segmentation,
  };
}

function buildRoomsFromAnalysis(analysis, shell) {
  const minRoomWidth = Math.max(72, Math.round(shell.shellWidth * 0.16));
  const minRoomHeight = Math.max(64, Math.round(shell.shellHeight * 0.16));
  const colors = [
    'rgba(75, 233, 212, 0.12)',
    'rgba(216, 255, 82, 0.12)',
    'rgba(255, 122, 89, 0.12)',
    'rgba(133, 160, 255, 0.12)',
    'rgba(120, 180, 255, 0.14)',
    'rgba(180, 120, 255, 0.14)',
    'rgba(255,255,255,0.08)',
  ];
  const names = analysis?.roomNames?.length
    ? analysis.roomNames
    : ['Living', 'Bedroom 1', 'Kitchen', 'Bedroom 2', 'Bath', 'Utility', 'Entry'];

  if (analysis?.roomBoxes?.length) {
    const mappedRooms = analysis.roomBoxes
      .map((roomBox, index) => ({
        name: names[index] || `Room ${index + 1}`,
        x: Math.round(shell.imageOffsetX + roomBox.x * shell.drawWidth),
        y: Math.round(shell.imageOffsetY + roomBox.y * shell.drawHeight),
        w: Math.round(roomBox.w * shell.drawWidth),
        h: Math.round(roomBox.h * shell.drawHeight),
        color: colors[index % colors.length],
      }))
      .filter((room) => room.w >= minRoomWidth && room.h >= minRoomHeight);

    if (mappedRooms.length) {
      return mappedRooms.slice(0, 8);
    }
  }

  const box = analysis?.box || { x: 0, y: 0, w: 1, h: 1 };
  const verticalCuts = analysis?.verticalCuts?.length
    ? analysis.verticalCuts
      .map((value) => ((value - box.x) / Math.max(box.w, 0.001)))
      .filter((value) => value > 0.08 && value < 0.92)
      .map((value) => shell.shellX + value * shell.shellWidth)
    : [
        shell.shellX + shell.shellWidth * 0.38,
        shell.shellX + shell.shellWidth * 0.64,
      ];
  const horizontalCuts = analysis?.horizontalCuts?.length
    ? analysis.horizontalCuts
      .map((value) => ((value - box.y) / Math.max(box.h, 0.001)))
      .filter((value) => value > 0.08 && value < 0.92)
      .map((value) => shell.shellY + value * shell.shellHeight)
    : [
        shell.shellY + shell.shellHeight * 0.42,
        shell.shellY + shell.shellHeight * 0.7,
      ];

  const xs = [shell.shellX, ...verticalCuts, shell.shellX + shell.shellWidth].sort((a, b) => a - b);
  const ys = [shell.shellY, ...horizontalCuts, shell.shellY + shell.shellHeight].sort((a, b) => a - b);

  const rooms = [];
  let roomIndex = 0;
  for (let row = 0; row < ys.length - 1; row += 1) {
    for (let col = 0; col < xs.length - 1; col += 1) {
      const x = Math.round(xs[col] + 8);
      const y = Math.round(ys[row] + 8);
      const w = Math.round(xs[col + 1] - xs[col] - 16);
      const h = Math.round(ys[row + 1] - ys[row] - 16);
      if (w < minRoomWidth || h < minRoomHeight) continue;
      rooms.push({
        name: names[roomIndex] || `Room ${roomIndex + 1}`,
        x,
        y,
        w,
        h,
        color: colors[roomIndex % colors.length],
      });
      roomIndex += 1;
    }
  }

  return rooms.length ? rooms.slice(0, 8) : [{
    name: 'Living',
    x: shell.shellX + 12,
    y: shell.shellY + 12,
    w: Math.round(shell.shellWidth * 0.45),
    h: Math.round(shell.shellHeight * 0.42),
    color: colors[0],
  }];
}

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function inspectPlanImage(image) {
  const sampleWidth = 240;
  const sampleHeight = Math.max(120, Math.round((image.height / image.width) * sampleWidth));
  const canvas = document.createElement('canvas');
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
  const intensity = new Array(sampleWidth * sampleHeight);
  let total = 0;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    intensity[i / 4] = gray;
    total += gray;
  }

  const threshold = Math.max(80, Math.min(210, total / intensity.length * 0.82));
  const rowDensity = new Array(sampleHeight).fill(0);
  const colDensity = new Array(sampleWidth).fill(0);
  let minX = sampleWidth;
  let minY = sampleHeight;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const isDark = intensity[y * sampleWidth + x] < threshold;
      if (!isDark) continue;
      rowDensity[y] += 1;
      colDensity[x] += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const padding = 0.02;
  const box = {
    x: minX < maxX ? Math.max(0, minX / sampleWidth - padding) : 0.08,
    y: minY < maxY ? Math.max(0, minY / sampleHeight - padding) : 0.08,
    w: minX < maxX ? Math.min(1, (maxX - minX) / sampleWidth + padding * 2) : 0.84,
    h: minY < maxY ? Math.min(1, (maxY - minY) / sampleHeight + padding * 2) : 0.84,
  };

  const verticalCuts = findStrongCuts(colDensity, sampleHeight, box.x, box.w);
  const horizontalCuts = findStrongCuts(rowDensity, sampleWidth, box.y, box.h);

  return { box, verticalCuts, horizontalCuts };
}

function findStrongCuts(density, axisLength, startRatio, spanRatio) {
  const start = Math.floor(density.length * startRatio);
  const end = Math.ceil(density.length * (startRatio + spanRatio));
  const maxDensity = Math.max(...density.slice(start, end), 1);
  const candidates = [];

  for (let i = start + 8; i < end - 8; i += 1) {
    const normalized = density[i] / axisLength;
    const isStrong = normalized > 0.18 || density[i] > maxDensity * 0.55;
    if (!isStrong) continue;
    candidates.push(i / density.length);
  }

  return collapseCuts(candidates).slice(0, 3);
}

function collapseCuts(cuts) {
  const result = [];
  cuts.forEach((cut) => {
    if (!result.length || Math.abs(result[result.length - 1] - cut) > 0.08) {
      result.push(cut);
    }
  });
  return result.filter((cut) => cut > 0.18 && cut < 0.82);
}

export function buildParsedModel(plan) {
  const walls = buildWallNetwork(plan);
  const openings = buildOpenings(plan, walls);

  return { plan, rooms: plan.rooms, walls, openings };
}

function buildWallNetwork(plan) {
  const shells = plan.outerWalls.flatMap((shell) => ([
    { x1: shell.x, y1: shell.y, x2: shell.x + shell.w, y2: shell.y, type: 'load-bearing', thickness: 0.3 },
    { x1: shell.x + shell.w, y1: shell.y, x2: shell.x + shell.w, y2: shell.y + shell.h, type: 'load-bearing', thickness: 0.3 },
    { x1: shell.x, y1: shell.y + shell.h, x2: shell.x + shell.w, y2: shell.y + shell.h, type: 'load-bearing', thickness: 0.3 },
    { x1: shell.x, y1: shell.y, x2: shell.x, y2: shell.y + shell.h, type: 'load-bearing', thickness: 0.3 },
  ]));

  const roomEdges = plan.rooms.flatMap((room) => ([
    { x1: room.x, y1: room.y, x2: room.x + room.w, y2: room.y, type: 'partition', thickness: 0.15 },
    { x1: room.x + room.w, y1: room.y, x2: room.x + room.w, y2: room.y + room.h, type: 'partition', thickness: 0.15 },
    { x1: room.x, y1: room.y + room.h, x2: room.x + room.w, y2: room.y + room.h, type: 'partition', thickness: 0.15 },
      { x1: room.x, y1: room.y, x2: room.x, y2: room.y + room.h, type: 'partition', thickness: 0.15 },
  ]));

  const sourceSegments = plan.wallSegments?.length ? plan.wallSegments : [...shells, ...roomEdges];
  const merged = new Map();
  let id = 1;

  sourceSegments.forEach((segment) => {
    const normalized = normalizeSegment(segment);
    const key = segmentKey(normalized);
    const existing = merged.get(key);

    if (existing) {
      existing.count += 1;
      existing.type = existing.type === 'load-bearing' || normalized.type === 'load-bearing' ? 'load-bearing' : 'partition';
      existing.thickness = Math.max(existing.thickness, normalized.thickness ?? 0.15);
      return;
    }

    merged.set(key, {
      ...normalized,
      id: `W${id++}`,
      count: normalized.count ?? 1,
    });
  });

  return Array.from(merged.values()).map((wall) => ({
    ...wall,
    orientation: Math.abs(wall.x2 - wall.x1) > Math.abs(wall.y2 - wall.y1) ? 'horizontal' : 'vertical',
    length: Number((Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) * plan.scale).toFixed(2)),
  }));
}

function buildOpenings(plan, walls) {
  if (plan.openings?.length) {
    const explicitOpenings = plan.openings.map((opening, index) => ({
      id: opening.id || `O${index + 1}`,
      ...opening,
    }));
    const needsDoors = !explicitOpenings.some((opening) => opening.type.includes('door'));
    const needsWindows = !explicitOpenings.some((opening) => opening.type === 'window');

    if (!needsDoors && !needsWindows) {
      return explicitOpenings;
    }

    const fallbackOpenings = buildFallbackOpenings(plan, walls).filter((opening) => (
      (needsDoors && opening.type.includes('door'))
      || (needsWindows && opening.type === 'window')
    ));
    return [...explicitOpenings, ...fallbackOpenings];
  }

  return buildFallbackOpenings(plan, walls);
}

function buildFallbackOpenings(plan, walls) {
  const openings = [];
  let openingId = 1;
  const shell = plan.outerWalls[0];

  if (shell) {
    openings.push({
      id: `O${openingId++}`,
      type: 'main-door',
      hostOrientation: 'horizontal',
      x: shell.x + shell.w * 0.5,
      y: shell.y + shell.h,
      width: 1.2,
    });
  }

  plan.rooms.forEach((room) => {
    const roomCenterX = room.x + room.w / 2;
    const roomCenterY = room.y + room.h / 2;
    const isWindowed = /bed|living|great|primary/i.test(room.name);

    if (isWindowed && shell) {
      const nearestShellSide = getNearestShellSide(room, shell);
      openings.push({
        id: `O${openingId++}`,
        type: 'window',
        hostOrientation: nearestShellSide.orientation,
        x: nearestShellSide.x ?? roomCenterX,
        y: nearestShellSide.y ?? roomCenterY,
        width: nearestShellSide.orientation === 'horizontal' ? 1.4 : 1.2,
      });
    }
  });

  walls
    .filter((wall) => wall.type === 'partition' && wall.count > 1 && wall.length > 1.1)
    .slice(0, Math.max(2, Math.min(6, plan.rooms.length - 1)))
    .forEach((wall) => {
      openings.push({
        id: `O${openingId++}`,
        type: 'door',
        hostOrientation: wall.orientation,
        x: (wall.x1 + wall.x2) / 2,
        y: (wall.y1 + wall.y2) / 2,
        width: 0.9,
      });
    });

  return openings;
}

function normalizeSegment(segment) {
  if (segment.x1 < segment.x2 || segment.y1 < segment.y2) return segment;
  return { ...segment, x1: segment.x2, y1: segment.y2, x2: segment.x1, y2: segment.y1 };
}

function segmentKey(segment) {
  return `${segment.x1},${segment.y1},${segment.x2},${segment.y2}`;
}

function getNearestShellSide(room, shell) {
  const distances = [
    { side: 'top', distance: Math.abs(room.y - shell.y), orientation: 'horizontal', x: room.x + room.w / 2, y: shell.y },
    { side: 'bottom', distance: Math.abs(shell.y + shell.h - (room.y + room.h)), orientation: 'horizontal', x: room.x + room.w / 2, y: shell.y + shell.h },
    { side: 'left', distance: Math.abs(room.x - shell.x), orientation: 'vertical', x: shell.x, y: room.y + room.h / 2 },
    { side: 'right', distance: Math.abs(shell.x + shell.w - (room.x + room.w)), orientation: 'vertical', x: shell.x + shell.w, y: room.y + room.h / 2 },
  ];

  return distances.sort((a, b) => a.distance - b.distance)[0];
}

export function buildGeometryModel(parsed) {
  const loadBearing = parsed.walls.filter((wall) => wall.type === 'load-bearing');
  const partition = parsed.walls.filter((wall) => wall.type === 'partition');
  const rooms = parsed.rooms.map((room) => {
    const area = Number((room.w * room.h * parsed.plan.scale * parsed.plan.scale).toFixed(1));
    const perimeter = Number((2 * (room.w + room.h) * parsed.plan.scale).toFixed(1));
    const span = Number((Math.max(room.w, room.h) * parsed.plan.scale).toFixed(1));
    return {
      ...room,
      area,
      perimeter,
      span,
      bbox: `(${room.x}, ${room.y}) -> (${room.x + room.w}, ${room.y + room.h})`,
      risk: span > 5 ? 'span-risk' : area > 18 ? 'large-program' : 'standard',
    };
  });

  const junctions = collectJunctions(parsed.walls);
  const maxSpan = Math.max(...rooms.map((room) => room.span));
  const shellArea = parsed.plan.outerWalls.reduce((sum, shell) => sum + shell.w * shell.h, 0) * parsed.plan.scale * parsed.plan.scale;
  const efficiency = Number(((parsed.plan.planArea / shellArea) * 100).toFixed(1));
  const alerts = [];

  if (maxSpan > 5) {
    alerts.push(`Unsupported span reaches ${maxSpan}m; consider beam or intermediate column support.`);
  }
  if (loadBearing.length < 4) {
    alerts.push('Load-bearing wall count is lower than expected for a stable residential shell.');
  }
  if (junctions.length < 12) {
    alerts.push('Low junction density may reduce lateral load redistribution paths.');
  }

  return {
    ...parsed,
    rooms,
    loadBearing,
    partition,
    junctions,
    maxSpan,
    metrics: {
      shellArea: Number(shellArea.toFixed(1)),
      efficiency,
      roomCount: rooms.length,
    },
    alerts,
  };
}

function collectJunctions(walls) {
  const unique = new Map();
  walls.forEach((wall) => {
    [`${Math.round(wall.x1)},${Math.round(wall.y1)}`, `${Math.round(wall.x2)},${Math.round(wall.y2)}`].forEach((point) => {
      if (!unique.has(point)) {
        const [x, y] = point.split(',').map(Number);
        unique.set(point, { id: `J-${point}`, x, y });
      }
    });
  });
  return Array.from(unique.values());
}

export function buildModelStats(geometry) {
  const scale = geometry.plan.scale * 8;
  const floorHeight = 3;
  const shellArea = geometry.plan.outerWalls.reduce((sum, shell) => sum + shell.w * shell.h, 0);
  const volume = shellArea * scale * scale * floorHeight;
  const vertexEstimate = geometry.walls.length * 24;

  return {
    floorHeight,
    volume: Math.round(volume),
    vertexEstimate,
    footprint: geometry.plan.outerWalls.length > 1 ? 'L-Shape' : 'Rectilinear',
    meshCount: geometry.walls.length,
  };
}

function buildSegmentationFromAnalysis(analysis, shell) {
  if (!analysis) return null;

  const wallRegions = (analysis.wallRegions || []).map((rect) => ({
    ...mapNormalizedRectToCanvas(rect, shell),
    orientation: rect.orientation || inferRectOrientation(rect),
  }));
  const wallLines = (analysis.wallLines || [])
    .map((line) => mapNormalizedLineToCanvas(line, shell))
    .map(snapLineToAxis)
    .filter(Boolean);
  const windows = (analysis.windowRects || []).map((rect) => ({
    ...mapNormalizedRectToCanvas(rect, shell),
    orientation: rect.orientation || inferRectOrientation(rect),
  }));
  const doors = (analysis.doorRects || []).map((rect) => ({
    ...mapNormalizedRectToCanvas(rect, shell),
    orientation: rect.orientation || inferRectOrientation(rect),
  }));

  if (!wallRegions.length && !wallLines.length && !windows.length && !doors.length) {
    return null;
  }

  return {
    walls: wallRegions,
    wallLines,
    windows,
    doors,
    source: analysis.segmentation ? 'backend-cv-segmentation' : 'browser-heuristic',
  };
}

function buildWallSegmentsFromAnalysis(segmentation, shell, scale) {
  const shellSegments = [
    { x1: shell.shellX, y1: shell.shellY, x2: shell.shellX + shell.shellWidth, y2: shell.shellY, type: 'load-bearing', thickness: 0.32 },
    { x1: shell.shellX + shell.shellWidth, y1: shell.shellY, x2: shell.shellX + shell.shellWidth, y2: shell.shellY + shell.shellHeight, type: 'load-bearing', thickness: 0.32 },
    { x1: shell.shellX, y1: shell.shellY + shell.shellHeight, x2: shell.shellX + shell.shellWidth, y2: shell.shellY + shell.shellHeight, type: 'load-bearing', thickness: 0.32 },
    { x1: shell.shellX, y1: shell.shellY, x2: shell.shellX, y2: shell.shellY + shell.shellHeight, type: 'load-bearing', thickness: 0.32 },
  ];

  if (!segmentation) {
    return [];
  }

  const detectedSegments = [
    ...segmentation.walls.map((rect) => rectToCenterline(rect, shell)),
    ...segmentation.wallLines.map((line) => ({
      ...line,
      type: isBoundarySegment(line, shell) ? 'load-bearing' : 'partition',
      thickness: isBoundarySegment(line, shell) ? 0.32 : 0.16,
    })),
  ].filter((segment) => segment && segmentLength(segment) * scale > 1.1);

  const merged = mergeAxisAlignedSegments([...shellSegments, ...detectedSegments]);
  return merged.length ? merged : shellSegments;
}

function buildOpeningsFromAnalysis(segmentation, shell, scale) {
  if (!segmentation) return [];

  const windows = segmentation.windows
    .filter((rect) => rect.w >= 10 || rect.h >= 10)
    .map((rect, index) => ({
      id: `CW${index + 1}`,
      type: 'window',
      hostOrientation: rect.orientation,
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
      width: Number((Math.max(rect.w, rect.h) * scale).toFixed(2)),
      source: 'segmentation',
    }));

  const doors = [...segmentation.doors]
    .sort((first, second) => (second.w * second.h) - (first.w * first.h))
    .filter((rect) => rect.w >= 10 || rect.h >= 10)
    .map((rect, index) => ({
      id: `CD${index + 1}`,
      type: isBoundaryRect(rect, shell) && index === 0 ? 'main-door' : 'door',
      hostOrientation: rect.orientation,
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
      width: Number((Math.max(rect.w, rect.h) * scale).toFixed(2)),
      source: 'segmentation',
    }));

  return [...doors, ...windows];
}

function mapNormalizedRectToCanvas(rect, shell) {
  return {
    x: Math.round(shell.imageOffsetX + rect.x * shell.drawWidth),
    y: Math.round(shell.imageOffsetY + rect.y * shell.drawHeight),
    w: Math.max(2, Math.round(rect.w * shell.drawWidth)),
    h: Math.max(2, Math.round(rect.h * shell.drawHeight)),
  };
}

function mapNormalizedLineToCanvas(line, shell) {
  return {
    x1: Math.round(shell.imageOffsetX + line.x1 * shell.drawWidth),
    y1: Math.round(shell.imageOffsetY + line.y1 * shell.drawHeight),
    x2: Math.round(shell.imageOffsetX + line.x2 * shell.drawWidth),
    y2: Math.round(shell.imageOffsetY + line.y2 * shell.drawHeight),
  };
}

function snapLineToAxis(line) {
  const dx = Math.abs(line.x2 - line.x1);
  const dy = Math.abs(line.y2 - line.y1);
  if (dx < 8 && dy < 8) return null;

  if (dx >= dy * 1.5) {
    const y = Math.round((line.y1 + line.y2) / 2);
    return {
      x1: Math.min(line.x1, line.x2),
      y1: y,
      x2: Math.max(line.x1, line.x2),
      y2: y,
    };
  }

  if (dy >= dx * 1.5) {
    const x = Math.round((line.x1 + line.x2) / 2);
    return {
      x1: x,
      y1: Math.min(line.y1, line.y2),
      x2: x,
      y2: Math.max(line.y1, line.y2),
    };
  }

  return null;
}

function inferRectOrientation(rect) {
  return rect.w >= rect.h ? 'horizontal' : 'vertical';
}

function rectToCenterline(rect, shell) {
  const orientation = rect.orientation || inferRectOrientation(rect);
  const isBoundary = isBoundaryRect(rect, shell);
  if (orientation === 'vertical') {
    const x = Math.round(rect.x + rect.w / 2);
    return {
      x1: x,
      y1: rect.y,
      x2: x,
      y2: rect.y + rect.h,
      type: isBoundary ? 'load-bearing' : 'partition',
      thickness: isBoundary ? 0.32 : 0.16,
    };
  }

  const y = Math.round(rect.y + rect.h / 2);
  return {
    x1: rect.x,
    y1: y,
    x2: rect.x + rect.w,
    y2: y,
    type: isBoundary ? 'load-bearing' : 'partition',
    thickness: isBoundary ? 0.32 : 0.16,
  };
}

function isBoundaryRect(rect, shell) {
  const shellRight = shell.shellX + shell.shellWidth;
  const shellBottom = shell.shellY + shell.shellHeight;
  return (
    Math.abs(rect.x - shell.shellX) < 18
    || Math.abs(rect.y - shell.shellY) < 18
    || Math.abs(rect.x + rect.w - shellRight) < 18
    || Math.abs(rect.y + rect.h - shellBottom) < 18
  );
}

function isBoundarySegment(segment, shell) {
  const shellRight = shell.shellX + shell.shellWidth;
  const shellBottom = shell.shellY + shell.shellHeight;
  return (
    Math.abs(segment.x1 - shell.shellX) < 18
    || Math.abs(segment.x2 - shell.shellX) < 18
    || Math.abs(segment.y1 - shell.shellY) < 18
    || Math.abs(segment.y2 - shell.shellY) < 18
    || Math.abs(segment.x1 - shellRight) < 18
    || Math.abs(segment.x2 - shellRight) < 18
    || Math.abs(segment.y1 - shellBottom) < 18
    || Math.abs(segment.y2 - shellBottom) < 18
  );
}

function mergeAxisAlignedSegments(segments) {
  const byKey = new Map();

  segments.forEach((segment) => {
    const normalized = normalizeSegment({
      ...segment,
      x1: Math.round(segment.x1),
      y1: Math.round(segment.y1),
      x2: Math.round(segment.x2),
      y2: Math.round(segment.y2),
    });
    const orientation = Math.abs(normalized.x2 - normalized.x1) >= Math.abs(normalized.y2 - normalized.y1) ? 'horizontal' : 'vertical';
    const axis = orientation === 'horizontal' ? Math.round(normalized.y1 / 6) * 6 : Math.round(normalized.x1 / 6) * 6;
    const start = orientation === 'horizontal' ? Math.min(normalized.x1, normalized.x2) : Math.min(normalized.y1, normalized.y2);
    const end = orientation === 'horizontal' ? Math.max(normalized.x1, normalized.x2) : Math.max(normalized.y1, normalized.y2);
    const type = normalized.type || 'partition';
    const key = `${orientation}:${axis}:${type}`;
    const bucket = byKey.get(key) || [];
    bucket.push({ ...normalized, start, end, axis, orientation });
    byKey.set(key, bucket);
  });

  const merged = [];
  byKey.forEach((bucket) => {
    bucket.sort((a, b) => a.start - b.start);
    let current = null;

    bucket.forEach((segment) => {
      if (!current) {
        current = { ...segment };
        return;
      }

      if (segment.start <= current.end + 10) {
        current.end = Math.max(current.end, segment.end);
        current.thickness = Math.max(current.thickness || 0.16, segment.thickness || 0.16);
        return;
      }

      merged.push(rehydrateMergedSegment(current));
      current = { ...segment };
    });

    if (current) {
      merged.push(rehydrateMergedSegment(current));
    }
  });

  return merged;
}

function rehydrateMergedSegment(segment) {
  if (segment.orientation === 'horizontal') {
    return {
      x1: segment.start,
      y1: segment.axis,
      x2: segment.end,
      y2: segment.axis,
      type: segment.type,
      thickness: segment.thickness,
    };
  }

  return {
    x1: segment.axis,
    y1: segment.start,
    x2: segment.axis,
    y2: segment.end,
    type: segment.type,
    thickness: segment.thickness,
  };
}

function segmentLength(segment) {
  return Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
}

export function buildMaterialAnalysis(geometry) {
  const sections = [
    { title: 'Load-Bearing Walls', count: geometry.loadBearing.length, isLoadBearing: true, candidates: ['RCC', 'Precast Concrete', 'Steel Frame', 'Red Brick'] },
    { title: 'Partition Walls', count: geometry.partition.length, isLoadBearing: false, candidates: ['AAC Blocks', 'Fly Ash Brick', 'Hollow Concrete Block', 'Red Brick'] },
    { title: 'Floor System', count: 1, isLoadBearing: true, candidates: ['RCC', 'Precast Concrete', 'Steel Frame'] },
    { title: 'Columns and Beams', count: Math.max(4, Math.floor(geometry.junctions.length / 8)), isLoadBearing: true, candidates: ['RCC', 'Steel Frame', 'Precast Concrete'] },
  ];

  const recommendations = sections.map((section) => ({
    ...section,
    ranked: section.candidates
      .map((name) => ({ name, ...materials[name], score: scoreMaterial(materials[name], section.isLoadBearing) }))
      .sort((a, b) => b.score - a.score),
  }));

  const topSelections = recommendations.map((section) => ({ section: section.title, top: section.ranked[0] }));
  const totalCostLakh = Number((geometry.plan.planArea * 0.032 + geometry.loadBearing.length * 0.07 + geometry.partition.length * 0.025).toFixed(2));
  const embodiedCarbon = Number((topSelections.reduce((sum, item) => sum + item.top.embodiedCarbon, 0) * 12.5).toFixed(1));
  const resilience = Number((topSelections.reduce((sum, item) => sum + item.top.durability + item.top.strength, 0) / topSelections.length).toFixed(1));

  return {
    recommendations,
    topSelections,
    summary: {
      totalCostLakh,
      embodiedCarbon,
      resilience,
      costEfficiency: Number((10 - totalCostLakh / 1.4).toFixed(1)),
    },
  };
}

function scoreMaterial(material, isLoadBearing) {
  const score = isLoadBearing
    ? material.strength * 0.5 + material.durability * 0.35 - material.cost * 0.15 - material.embodiedCarbon * 0.05
    : material.strength * 0.2 + material.durability * 0.25 - material.cost * 0.4 - material.embodiedCarbon * 0.05;
  return Number(score.toFixed(2));
}

export function buildExplainabilityReport(plan, geometry, materialAnalysis) {
  const materialLine = materialAnalysis.topSelections.map((item) => `${item.section}: ${item.top.name}`).join(', ');
  const concerns = geometry.maxSpan > 5
    ? `The largest span is ${geometry.maxSpan}m, so beam deepening or intermediate columns should be reviewed before IFC handoff.`
    : 'No critical span exceeds 5m, which keeps the primary shell within a straightforward residential design range.';

  return [
    {
      title: 'Executive Summary',
      body: `This ${plan.name} covers ${plan.planArea} m2 with ${geometry.rooms.length} programmed spaces and ${geometry.loadBearing.length} load-bearing wall segments. The geometry is ${geometry.plan.outerWalls.length > 1 ? 'non-rectilinear' : 'rectilinear'}, which affects reconstruction complexity but remains manageable for a mid-rise residential workflow. Recommended headline package: ${materialLine}.`,
    },
    {
      title: 'Structural Assessment',
      body: `Junction density is ${geometry.junctions.length}, indicating ${geometry.junctions.length > 25 ? 'a strong load redistribution mesh' : 'a moderate support mesh'} across the plan. Partition count sits at ${geometry.partition.length}, which balances spatial flexibility with shell clarity. ${concerns}`,
    },
    {
      title: 'Material Logic',
      body: `RCC and precast options dominate load-bearing elements because strength and durability outweigh first-cost in the structural score. AAC blocks and fly ash brick stay competitive for partitions because they lower dead load and improve speed of execution without overspecifying the partition package. The current recommendation set targets high resilience while keeping the total cost near INR ${materialAnalysis.summary.totalCostLakh} lakh for the structural package.`,
    },
    {
      title: 'Delivery Notes',
      body: `This frontend demonstrates all five pipeline stages with realistic state flow, persistence, 2D parsing visuals, 3D generation, and report export. In production, the parser can be connected to CV inference and the report stage can call an LLM service using the same structured payload already generated in-app.`,
    },
  ];
}
