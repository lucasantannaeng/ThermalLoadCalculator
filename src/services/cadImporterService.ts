import DxfParser from 'dxf-parser';
import { HVACEnvironment, Orientation, Wall, Window, ActivityType } from '../types/hvac';
import {
  CADPoint,
  CADEntity,
  CADLayerInfo,
  CADParseResult,
  CADPolygon,
  CADWallSegment,
  CADWindowItem,
  CADImportConfig
} from '../types/cad';

export type {
  CADPoint,
  CADEntity,
  CADLayerInfo,
  CADParseResult,
  CADPolygon,
  CADWallSegment,
  CADWindowItem,
  CADImportConfig
};

// Map AutoCAD Color Index (ACI) to Hex strings
const ACI_COLORS: Record<number, string> = {
  1: '#ef4444', // Red
  2: '#eab308', // Yellow
  3: '#22c55e', // Green
  4: '#06b6d4', // Cyan
  5: '#3b82f6', // Blue
  6: '#ec4899', // Magenta
  7: '#f8fafc', // White / Light
  8: '#64748b', // Dark Gray
  9: '#94a3b8', // Light Gray
};

export function getLayerColor(colorIndex?: number): string {
  if (colorIndex && ACI_COLORS[colorIndex]) {
    return ACI_COLORS[colorIndex];
  }
  return '#06b6d4'; // default cyan
}

/**
 * Sanitizes point list by removing duplicate consecutive vertices and duplicate closing vertex.
 */
export function sanitizePoints(points: CADPoint[]): CADPoint[] {
  if (!points || points.length === 0) return [];
  const result: CADPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (result.length > 0) {
      const prev = result[result.length - 1];
      if (Math.hypot(pt.x - prev.x, pt.y - prev.y) < 1e-6) {
        continue; // Skip duplicate consecutive vertex
      }
    }
    result.push({ x: pt.x, y: pt.y });
  }

  // If last point equals first point, remove redundant closing vertex
  if (
    result.length > 1 &&
    Math.hypot(
      result[result.length - 1].x - result[0].x,
      result[result.length - 1].y - result[0].y
    ) < 1e-6
  ) {
    result.pop();
  }

  return result;
}

/**
 * Calculates polygon area using the exact Shoelace Formula (Fórmula de Gauss).
 * Area = 1/2 * | sum(x_i * y_{i+1} - x_{i+1} * y_i) |
 */
export function calculateShoelaceArea(points: CADPoint[]): number {
  const pts = sanitizePoints(points);
  if (pts.length < 3) return 0;
  let sum = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    sum += pts[i].x * pts[next].y - pts[next].x * pts[i].y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Calculates signed Shoelace area.
 * Positive if Counter-Clockwise (CCW), negative if Clockwise (CW) in standard Cartesian grid (+X Right, +Y Up).
 */
export function calculateSignedShoelaceArea(points: CADPoint[]): number {
  const pts = sanitizePoints(points);
  if (pts.length < 3) return 0;
  let sum = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    sum += pts[i].x * pts[next].y - pts[next].x * pts[i].y;
  }
  return sum / 2;
}

/**
 * Calculates polygon perimeter in meters.
 */
export function calculatePerimeter(points: CADPoint[]): number {
  const pts = sanitizePoints(points);
  if (pts.length < 2) return 0;
  let len = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const dx = pts[next].x - pts[i].x;
    const dy = pts[next].y - pts[i].y;
    len += Math.hypot(dx, dy);
  }
  return len;
}

/**
 * Calculates the centroid (center of mass) of a polygon.
 */
export function calculateCentroid(points: CADPoint[]): CADPoint {
  const pts = sanitizePoints(points);
  if (pts.length === 0) return { x: 0, y: 0 };
  const signedArea = calculateSignedShoelaceArea(pts);
  const n = pts.length;
  if (Math.abs(signedArea) < 1e-6) {
    let sx = 0, sy = 0;
    for (const p of pts) { sx += p.x; sy += p.y; }
    return { x: sx / n, y: sy / n };
  }
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const factor = (pts[i].x * pts[next].y - pts[next].x * pts[i].y);
    cx += (pts[i].x + pts[next].x) * factor;
    cy += (pts[i].y + pts[next].y) * factor;
  }
  const denominator = 6 * signedArea;
  return { x: cx / denominator, y: cy / denominator };
}

/**
 * Determines edge outward normal vectors and maps normal vector to cardinal orientation
 * ('norte', 'sul', 'leste', 'oeste') with optional North Angle Offset.
 */
export function mapNormalToOrientation(
  normal: CADPoint,
  northAngleOffsetDegrees: number = 0
): Orientation {
  // Angle of normal vector in degrees (-180 to 180)
  // Standard Cartesian: +Y is 90°, +X is 0°, -Y is -90°, -X is 180°/-180°
  const rawAngle = (Math.atan2(normal.y, normal.x) * 180) / Math.PI;

  // Relative angle to North taking North Offset into account
  let angleDeg = rawAngle + northAngleOffsetDegrees;

  // Normalize to [-180, 180)
  while (angleDeg >= 180) angleDeg -= 360;
  while (angleDeg < -180) angleDeg += 360;

  if (angleDeg >= 45 && angleDeg < 135) {
    return 'norte';
  } else if (angleDeg >= -135 && angleDeg < -45) {
    return 'sul';
  } else if (angleDeg >= -45 && angleDeg < 45) {
    return 'leste';
  } else {
    return 'oeste';
  }
}

/**
 * Extracts wall segments from a polygon vertex array with outward normal vectors.
 */
export function extractWallSegments(
  points: CADPoint[],
  northAngleOffsetDegrees: number = 0
): CADWallSegment[] {
  const pts = sanitizePoints(points);
  if (pts.length < 3) return [];
  const signedArea = calculateSignedShoelaceArea(pts);
  const isCCW = signedArea > 0;
  const n = pts.length;
  const segments: CADWallSegment[] = [];

  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);

    if (len < 1e-5) continue;

    // Unit tangent
    const tx = dx / len;
    const ty = dy / len;

    // Outward normal vector
    // For CCW polygon, right-hand normal (ty, -tx) points outward.
    // For CW polygon, left-hand normal (-ty, tx) points outward.
    const nx = isCCW ? ty : -ty;
    const ny = isCCW ? -tx : tx;

    const orientation = mapNormalToOrientation({ x: nx, y: ny }, northAngleOffsetDegrees);

    segments.push({
      p1,
      p2,
      length: len,
      orientation,
      outwardNormal: { x: nx, y: ny }
    });
  }

  return segments;
}

/**
 * Detects North direction vector angle in DXF text ($NORTHDIR header variable or North layers).
 */
export function detectNorthAngleFromDXF(dxfText: string): number | undefined {
  // 1. Check DXF $NORTHDIR header variable
  const northDirMatch = dxfText.match(/\$NORTHDIR\s*[\r\n]+\s*50\s*[\r\n]+\s*([0-9.-]+)/i);
  if (northDirMatch) {
    const angle = parseFloat(northDirMatch[1]);
    if (!isNaN(angle)) return (angle % 360 + 360) % 360;
  }
  return undefined;
}

/**
 * Detects North direction vector angle in SVG text.
 */
export function detectNorthAngleFromSVG(svgText: string): number | undefined {
  // Search for north indicator tag/layer or line attribute labeled 'north' or 'norte'
  const northLineMatch = svgText.match(/<line\s+[^>]*id=["'](?:north|norte)[^"']*["'][^>]*x1=["']([^"']+)["']\s+y1=["']([^"']+)["']\s+x2=["']([^"']+)["']\s+y2=["']([^"']+)["']/i);
  if (northLineMatch) {
    const x1 = parseFloat(northLineMatch[1]);
    const y1 = parseFloat(northLineMatch[2]);
    const x2 = parseFloat(northLineMatch[3]);
    const y2 = parseFloat(northLineMatch[4]);
    // SVG Y goes down, invert dy
    const dx = x2 - x1;
    const dy = -(y2 - y1);
    const angleRad = Math.atan2(dx, dy); // 0 when dy > 0 (Up)
    let angleDeg = (angleRad * 180) / Math.PI;
    return (angleDeg % 360 + 360) % 360;
  }
  return undefined;
}

/**
 * Parses a DXF text file into structured layers and entities.
 */
export function parseDXF(dxfText: string, scaleFactor: number = 1.0): CADParseResult {
  const parser = new DxfParser();
  let dxfData: any = null;
  try {
    dxfData = parser.parseSync(dxfText);
  } catch (err) {
    console.error('Error parsing DXF text:', err);
    throw new Error('Falha ao processar arquivo DXF. Verifique o formato do arquivo.');
  }

  const layerMap = new Map<string, CADLayerInfo>();
  const entities: CADEntity[] = [];

  // Register layers from DXF tables if present
  if (dxfData && dxfData.tables && dxfData.tables.layer && dxfData.tables.layer.layers) {
    const rawLayers = dxfData.tables.layer.layers;
    Object.keys(rawLayers).forEach((layerName) => {
      const l = rawLayers[layerName];
      layerMap.set(layerName, {
        name: layerName,
        color: getLayerColor(l.colorIndex || l.color),
        entityCount: 0
      });
    });
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const updateBounds = (pt: CADPoint) => {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  };

  if (dxfData && dxfData.entities && Array.isArray(dxfData.entities)) {
    dxfData.entities.forEach((ent: any, idx: number) => {
      const layerName = ent.layer || '0';
      if (!layerMap.has(layerName)) {
        layerMap.set(layerName, {
          name: layerName,
          color: getLayerColor(),
          entityCount: 0
        });
      }

      const points: CADPoint[] = [];

      if (ent.type === 'LINE' && ent.vertices && ent.vertices.length >= 2) {
        points.push(
          { x: ent.vertices[0].x * scaleFactor, y: ent.vertices[0].y * scaleFactor },
          { x: ent.vertices[1].x * scaleFactor, y: ent.vertices[1].y * scaleFactor }
        );
      } else if (
        (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') &&
        ent.vertices &&
        Array.isArray(ent.vertices)
      ) {
        ent.vertices.forEach((v: any) => {
          if (typeof v.x === 'number' && typeof v.y === 'number') {
            points.push({ x: v.x * scaleFactor, y: v.y * scaleFactor });
          }
        });
      } else if (ent.type === 'CIRCLE' && ent.center && typeof ent.radius === 'number') {
        const cx = ent.center.x * scaleFactor;
        const cy = ent.center.y * scaleFactor;
        const r = ent.radius * scaleFactor;
        const segments = 16;
        for (let i = 0; i < segments; i++) {
          const theta = (i * 2 * Math.PI) / segments;
          points.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
        }
      }

      if (points.length > 0) {
        points.forEach(updateBounds);
        const cadEnt: CADEntity = {
          id: `dxf-ent-${idx}`,
          type: ent.type as any,
          layer: layerName,
          points,
          closed: !!ent.shape || ent.type === 'CIRCLE'
        };
        entities.push(cadEnt);
        const lInfo = layerMap.get(layerName)!;
        lInfo.entityCount += 1;
      }
    });
  }

  if (minX === Infinity) {
    minX = 0; minY = 0; maxX = 10; maxY = 10;
  }

  const detectedNorthAngle = detectNorthAngleFromDXF(dxfText);

  return {
    layers: Array.from(layerMap.values()),
    entities,
    bounds: { minX, minY, maxX, maxY },
    detectedNorthAngle,
    fileType: 'dxf'
  };
}

/**
 * Parses an SVG text file into structured layers and entities.
 */
export function parseSVG(svgText: string, scaleFactor: number = 1.0): CADParseResult {
  const layerMap = new Map<string, CADLayerInfo>();
  const entities: CADEntity[] = [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const updateBounds = (pt: CADPoint) => {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  };

  const getLayerName = (nodeStr: string, parentGroupLayer?: string): string => {
    const inkMatch = nodeStr.match(/inkscape:label=["']([^"']+)["']/i);
    if (inkMatch) return inkMatch[1];
    const idMatch = nodeStr.match(/id=["']([^"']+)["']/i);
    if (idMatch && !idMatch[1].startsWith('path') && !idMatch[1].startsWith('rect')) return idMatch[1];
    const classMatch = nodeStr.match(/class=["']([^"']+)["']/i);
    if (classMatch) return classMatch[1];
    return parentGroupLayer || 'Default';
  };

  const touchLayer = (layerName: string) => {
    if (!layerMap.has(layerName)) {
      layerMap.set(layerName, {
        name: layerName,
        color: getLayerColor(layerMap.size + 1),
        entityCount: 0
      });
    }
  };

  // Extract <polygon> elements
  const polygonRegex = /<polygon\s+([^>]+)>/gi;
  let match: RegExpExecArray | null;
  let entIdx = 0;

  while ((match = polygonRegex.exec(svgText)) !== null) {
    const attrStr = match[1];
    const layer = getLayerName(attrStr);
    touchLayer(layer);

    const ptsMatch = attrStr.match(/points=["']([^"']+)["']/i);
    if (ptsMatch) {
      const rawPairs = ptsMatch[1].trim().split(/[\s,]+/);
      const points: CADPoint[] = [];
      for (let i = 0; i < rawPairs.length - 1; i += 2) {
        const x = parseFloat(rawPairs[i]) * scaleFactor;
        const y = parseFloat(rawPairs[i + 1]) * scaleFactor;
        if (!isNaN(x) && !isNaN(y)) {
          points.push({ x, y });
        }
      }
      if (points.length >= 3) {
        points.forEach(updateBounds);
        entities.push({
          id: `svg-poly-${entIdx++}`,
          type: 'POLYGON',
          layer,
          points,
          closed: true
        });
        layerMap.get(layer)!.entityCount += 1;
      }
    }
  }

  // Extract <rect> elements
  const rectRegex = /<rect\s+([^>]+)>/gi;
  while ((match = rectRegex.exec(svgText)) !== null) {
    const attrStr = match[1];
    const layer = getLayerName(attrStr);
    touchLayer(layer);

    const xM = attrStr.match(/x=["']([^"']+)["']/i);
    const yM = attrStr.match(/y=["']([^"']+)["']/i);
    const wM = attrStr.match(/width=["']([^"']+)["']/i);
    const hM = attrStr.match(/height=["']([^"']+)["']/i);

    const x = (xM ? parseFloat(xM[1]) : 0) * scaleFactor;
    const y = (yM ? parseFloat(yM[1]) : 0) * scaleFactor;
    const w = (wM ? parseFloat(wM[1]) : 0) * scaleFactor;
    const h = (hM ? parseFloat(hM[1]) : 0) * scaleFactor;

    if (w > 0 && h > 0) {
      const points: CADPoint[] = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
      ];
      points.forEach(updateBounds);
      entities.push({
        id: `svg-rect-${entIdx++}`,
        type: 'RECT',
        layer,
        points,
        closed: true
      });
      layerMap.get(layer)!.entityCount += 1;
    }
  }

  // Extract <polyline> elements
  const polylineRegex = /<polyline\s+([^>]+)>/gi;
  while ((match = polylineRegex.exec(svgText)) !== null) {
    const attrStr = match[1];
    const layer = getLayerName(attrStr);
    touchLayer(layer);

    const ptsMatch = attrStr.match(/points=["']([^"']+)["']/i);
    if (ptsMatch) {
      const rawPairs = ptsMatch[1].trim().split(/[\s,]+/);
      const points: CADPoint[] = [];
      for (let i = 0; i < rawPairs.length - 1; i += 2) {
        const x = parseFloat(rawPairs[i]) * scaleFactor;
        const y = parseFloat(rawPairs[i + 1]) * scaleFactor;
        if (!isNaN(x) && !isNaN(y)) {
          points.push({ x, y });
        }
      }
      if (points.length >= 2) {
        points.forEach(updateBounds);
        entities.push({
          id: `svg-pline-${entIdx++}`,
          type: 'POLYLINE',
          layer,
          points,
          closed: false
        });
        layerMap.get(layer)!.entityCount += 1;
      }
    }
  }

  // Extract <line> elements
  const lineRegex = /<line\s+([^>]+)>/gi;
  while ((match = lineRegex.exec(svgText)) !== null) {
    const attrStr = match[1];
    const layer = getLayerName(attrStr);
    touchLayer(layer);

    const x1M = attrStr.match(/x1=["']([^"']+)["']/i);
    const y1M = attrStr.match(/y1=["']([^"']+)["']/i);
    const x2M = attrStr.match(/x2=["']([^"']+)["']/i);
    const y2M = attrStr.match(/y2=["']([^"']+)["']/i);

    const x1 = (x1M ? parseFloat(x1M[1]) : 0) * scaleFactor;
    const y1 = (y1M ? parseFloat(y1M[1]) : 0) * scaleFactor;
    const x2 = (x2M ? parseFloat(x2M[1]) : 0) * scaleFactor;
    const y2 = (y2M ? parseFloat(y2M[1]) : 0) * scaleFactor;

    const points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    points.forEach(updateBounds);
    entities.push({
      id: `svg-line-${entIdx++}`,
      type: 'LINE',
      layer,
      points,
      closed: false
    });
    layerMap.get(layer)!.entityCount += 1;
  }

  // Extract <path> elements
  const pathRegex = /<path\s+([^>]+)>/gi;
  while ((match = pathRegex.exec(svgText)) !== null) {
    const attrStr = match[1];
    const layer = getLayerName(attrStr);
    touchLayer(layer);

    const dMatch = attrStr.match(/d=["']([^"']+)["']/i);
    if (dMatch) {
      const parsedPath = parseSVGPathData(dMatch[1], scaleFactor);
      if (parsedPath.points.length >= 2) {
        parsedPath.points.forEach(updateBounds);
        entities.push({
          id: `svg-path-${entIdx++}`,
          type: 'PATH',
          layer,
          points: parsedPath.points,
          closed: parsedPath.closed
        });
        layerMap.get(layer)!.entityCount += 1;
      }
    }
  }

  if (minX === Infinity) {
    minX = 0; minY = 0; maxX = 10; maxY = 10;
  }

  const detectedNorthAngle = detectNorthAngleFromSVG(svgText);

  return {
    layers: Array.from(layerMap.values()),
    entities,
    bounds: { minX, minY, maxX, maxY },
    detectedNorthAngle,
    fileType: 'svg'
  };
}

/**
 * Parses SVG path `d` attribute data into 2D CAD points.
 */
export function parseSVGPathData(d: string, scaleFactor: number = 1.0): { points: CADPoint[]; closed: boolean } {
  const tokens = d.match(/([a-zA-Z])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/g) || [];
  const points: CADPoint[] = [];
  let curX = 0, curY = 0;
  let startX = 0, startY = 0;
  let closed = false;
  let i = 0;
  let currentCmd = '';

  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[a-zA-Z]$/.test(token)) {
      currentCmd = token;
      i++;
      if (currentCmd === 'Z' || currentCmd === 'z') {
        closed = true;
        curX = startX; curY = startY;
      }
      continue;
    }

    if (currentCmd === 'M' || currentCmd === 'm') {
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      if (currentCmd === 'm' && points.length > 0) {
        curX += x; curY += y;
      } else {
        curX = x; curY = y;
      }
      startX = curX; startY = curY;
      points.push({ x: curX * scaleFactor, y: curY * scaleFactor });
      currentCmd = currentCmd === 'M' ? 'L' : 'l';
    } else if (currentCmd === 'L' || currentCmd === 'l') {
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      if (currentCmd === 'l') {
        curX += x; curY += y;
      } else {
        curX = x; curY = y;
      }
      points.push({ x: curX * scaleFactor, y: curY * scaleFactor });
    } else if (currentCmd === 'H' || currentCmd === 'h') {
      const x = parseFloat(tokens[i++]);
      curX = currentCmd === 'h' ? curX + x : x;
      points.push({ x: curX * scaleFactor, y: curY * scaleFactor });
    } else if (currentCmd === 'V' || currentCmd === 'v') {
      const y = parseFloat(tokens[i++]);
      curY = currentCmd === 'v' ? curY + y : y;
      points.push({ x: curX * scaleFactor, y: curY * scaleFactor });
    } else {
      i++;
    }
  }

  return { points, closed };
}

/**
 * Parses an Industry Foundation Classes (IFC) STEP file (ISO 10303-21) into structured layers and entities.
 */
export function parseIFC(ifcText: string, scaleFactor: number = 1.0): CADParseResult {
  const layerMap = new Map<string, CADLayerInfo>();
  const entities: CADEntity[] = [];

  const touchLayer = (layerName: string, color?: string) => {
    if (!layerMap.has(layerName)) {
      layerMap.set(layerName, {
        name: layerName,
        color: color || getLayerColor(layerMap.size + 1),
        entityCount: 0
      });
    }
  };

  // STEP File parsing maps
  const pointsMap = new Map<string, CADPoint>();
  const polyloopMap = new Map<string, CADPoint[]>();
  const polylineMap = new Map<string, CADPoint[]>();
  const directionMap = new Map<string, CADPoint>();
  let detectedNorthAngle: number | undefined = undefined;

  // Split STEP records by ';' while stripping comments
  const cleanText = ifcText.replace(/\/\*[\s\S]*?\*\//g, '');
  const statements = cleanText.split(';');

  let entIdx = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const updateBounds = (pt: CADPoint) => {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  };

  // Step 1: First pass - Collect Cartesian points, Directions, and Profile definitions
  statements.forEach((stmt) => {
    const line = stmt.trim();
    if (!line.startsWith('#')) return;

    const match = line.match(/^#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\((.*)\)$/s);
    if (!match) return;

    const id = match[1];
    const entityType = match[2].toUpperCase();
    const argsStr = match[3];

    if (entityType === 'IFCCARTESIANPOINT') {
      const coordsMatch = argsStr.match(/\(([^()]+)\)/);
      if (coordsMatch) {
        const nums = coordsMatch[1].split(',').map((n) => parseFloat(n.trim()));
        if (nums.length >= 2 && !isNaN(nums[0]) && !isNaN(nums[1])) {
          pointsMap.set(id, { x: nums[0] * scaleFactor, y: nums[1] * scaleFactor });
        }
      }
    } else if (entityType === 'IFCDIRECTION') {
      const coordsMatch = argsStr.match(/\(([^()]+)\)/);
      if (coordsMatch) {
        const nums = coordsMatch[1].split(',').map((n) => parseFloat(n.trim()));
        if (nums.length >= 2 && !isNaN(nums[0]) && !isNaN(nums[1])) {
          directionMap.set(id, { x: nums[0], y: nums[1] });
        }
      }
    } else if (entityType === 'IFCRECTANGLEPROFILEDEF') {
      // e.g. IFCRECTANGLEPROFILEDEF(.AREA., 'Profile', $, 10.0, 8.0);
      const nums = argsStr.match(/([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g);
      if (nums && nums.length >= 2) {
        const w = parseFloat(nums[nums.length - 2]) * scaleFactor;
        const h = parseFloat(nums[nums.length - 1]) * scaleFactor;
        if (w > 0 && h > 0) {
          const pts: CADPoint[] = [
            { x: 0, y: 0 },
            { x: w, y: 0 },
            { x: w, y: h },
            { x: 0, y: h }
          ];
          polyloopMap.set(id, pts);
        }
      }
    }
  });

  // Check True North direction vector from IFC
  directionMap.forEach((dir) => {
    if (detectedNorthAngle === undefined) {
      // If direction vector points (dx, dy), calculate angle relative to +Y North (0°)
      const angleRad = Math.atan2(dir.x, dir.y);
      let angleDeg = Math.round((angleRad * 180) / Math.PI);
      detectedNorthAngle = (angleDeg % 360 + 360) % 360;
    }
  });

  // Step 2: Second pass - Collect Polyloops & Polylines
  statements.forEach((stmt) => {
    const line = stmt.trim();
    if (!line.startsWith('#')) return;

    const match = line.match(/^#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\((.*)\)$/s);
    if (!match) return;

    const id = match[1];
    const entityType = match[2].toUpperCase();
    const argsStr = match[3];

    if (entityType === 'IFCPOLYLOOP') {
      const refMatches = argsStr.match(/#(\d+)/g);
      if (refMatches) {
        const pts: CADPoint[] = [];
        refMatches.forEach((ref) => {
          const ptId = ref.substring(1);
          const p = pointsMap.get(ptId);
          if (p) pts.push(p);
        });
        if (pts.length >= 3) {
          polyloopMap.set(id, pts);
        }
      }
    } else if (entityType === 'IFCPOLYLINE') {
      const refMatches = argsStr.match(/#(\d+)/g);
      if (refMatches) {
        const pts: CADPoint[] = [];
        refMatches.forEach((ref) => {
          const ptId = ref.substring(1);
          const p = pointsMap.get(ptId);
          if (p) pts.push(p);
        });
        if (pts.length >= 2) {
          polylineMap.set(id, pts);
        }
      }
    }
  });

  // Step 3: Third pass - Extract Semantic IFC Objects (IFCSPACE, IFCWALL, IFCWINDOW)
  statements.forEach((stmt) => {
    const line = stmt.trim();
    if (!line.startsWith('#')) return;

    const match = line.match(/^#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\((.*)\)$/s);
    if (!match) return;

    const entityType = match[2].toUpperCase();
    const argsStr = match[3];

    let layerName = '';
    let cadType: CADEntity['type'] = 'POLYGON';

    if (entityType === 'IFCSPACE') {
      layerName = 'IfcSpace';
      cadType = 'IFCSPACE';
    } else if (entityType === 'IFCWALL' || entityType === 'IFCWALLSTANDARDCASE') {
      layerName = 'IfcWall';
      cadType = 'IFCWALL';
    } else if (entityType === 'IFCWINDOW') {
      layerName = 'IfcWindow';
      cadType = 'IFCWINDOW';
    }

    if (layerName) {
      touchLayer(layerName);
      // Extract optional object name from string parameters (IFC format: param 1 is GlobalId, param 3/2nd string is Name)
      const stringMatches = Array.from(argsStr.matchAll(/'([^']*)'/g)).map((m) => m[1]);
      const name = stringMatches.length >= 2 ? stringMatches[1] : stringMatches[0];

      // Find referenced polyloops or polylines in args
      const refs = argsStr.match(/#(\d+)/g) || [];
      let foundGeometry = false;

      for (const ref of refs) {
        const refId = ref.substring(1);
        const polyPts = polyloopMap.get(refId) || polylineMap.get(refId);

        if (polyPts && polyPts.length >= 2) {
          polyPts.forEach(updateBounds);
          entities.push({
            id: `ifc-ent-${entIdx++}`,
            type: cadType,
            layer: layerName,
            name: name || `${layerName} ${entities.length + 1}`,
            points: polyPts,
            closed: polyPts.length >= 3
          });
          layerMap.get(layerName)!.entityCount += 1;
          foundGeometry = true;
          break;
        }
      }

      if (!foundGeometry && polyloopMap.size > 0) {
        // Fallback: assign available polyloops to the IFCSpace if unassigned
        polyloopMap.forEach((pts, loopId) => {
          if (!foundGeometry && pts.length >= 3) {
            pts.forEach(updateBounds);
            entities.push({
              id: `ifc-ent-fallback-${entIdx++}`,
              type: cadType,
              layer: layerName,
              name: name || `Ambiente IFC ${entities.length + 1}`,
              points: pts,
              closed: true
            });
            layerMap.get(layerName)!.entityCount += 1;
            foundGeometry = true;
          }
        });
      }
    }
  });

  // Step 4: Add remaining unassigned Polyloops / Polylines as geometry entities
  if (entities.length === 0) {
    polyloopMap.forEach((pts) => {
      touchLayer('IfcSpace');
      pts.forEach(updateBounds);
      entities.push({
        id: `ifc-polyloop-${entIdx++}`,
        type: 'POLYGON',
        layer: 'IfcSpace',
        name: `Ambiente IFC ${entities.length + 1}`,
        points: pts,
        closed: true
      });
      layerMap.get('IfcSpace')!.entityCount += 1;
    });

    polylineMap.forEach((pts) => {
      touchLayer('IfcWall');
      pts.forEach(updateBounds);
      entities.push({
        id: `ifc-polyline-${entIdx++}`,
        type: 'POLYLINE',
        layer: 'IfcWall',
        points: pts,
        closed: false
      });
      layerMap.get('IfcWall')!.entityCount += 1;
    });
  }

  if (minX === Infinity) {
    minX = 0; minY = 0; maxX = 10; maxY = 10;
  }

  return {
    layers: Array.from(layerMap.values()),
    entities,
    bounds: { minX, minY, maxX, maxY },
    detectedNorthAngle,
    fileType: 'ifc'
  };
}

/**
 * Extracts environment polygons from entities.
 * Automatically identifies explicit closed polygons and connects open line chains into closed loops.
 */
export function extractPolygonsFromEntities(
  entities: CADEntity[],
  targetLayers: string[]
): CADPolygon[] {
  const targetSet = new Set(targetLayers.map((l) => l.toLowerCase()));
  const filtered = entities.filter((e) => targetSet.size === 0 || targetSet.has(e.layer.toLowerCase()));

  const polygons: CADPolygon[] = [];
  const openEntities: CADEntity[] = [];

  // 1. Process explicit closed entities
  filtered.forEach((ent, idx) => {
    if ((ent.closed || ent.type === 'POLYGON' || ent.type === 'RECT' || ent.type === 'IFCSPACE') && ent.points.length >= 3) {
      const sanitized = sanitizePoints(ent.points);
      const area = calculateShoelaceArea(sanitized);
      if (area >= 0.5) { // Minimum 0.5 m² threshold to ignore micro artifacts
        polygons.push({
          id: `poly-explicit-${idx}`,
          layer: ent.layer,
          name: ent.name || `Ambiente ${polygons.length + 1} (${ent.layer})`,
          points: sanitized,
          area,
          perimeter: calculatePerimeter(sanitized),
          centroid: calculateCentroid(sanitized)
        });
      }
    } else if (ent.points.length >= 2) {
      openEntities.push(ent);
    }
  });

  // 2. Connect open line chains into closed loops if any exist
  if (openEntities.length >= 3) {
    const loops = findClosedLoopsFromLines(openEntities);
    loops.forEach((loopPts, idx) => {
      const sanitized = sanitizePoints(loopPts);
      const area = calculateShoelaceArea(sanitized);
      if (area >= 0.5) {
        polygons.push({
          id: `poly-chained-${idx}`,
          layer: openEntities[0]?.layer || 'ConnectedLines',
          name: `Ambiente ${polygons.length + 1}`,
          points: sanitized,
          area,
          perimeter: calculatePerimeter(sanitized),
          centroid: calculateCentroid(sanitized)
        });
      }
    });
  }

  return polygons;
}

/**
 * Graph cycle finder to connect line segments into closed polygons.
 */
function findClosedLoopsFromLines(lineEntities: CADEntity[]): CADPoint[][] {
  const tolerance = 0.05; // 5 cm tolerance for CAD vertex snapping
  const pointsEqual = (p1: CADPoint, p2: CADPoint) =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y) <= tolerance;

  const edges: [CADPoint, CADPoint][] = [];
  lineEntities.forEach((ent) => {
    for (let i = 0; i < ent.points.length - 1; i++) {
      edges.push([ent.points[i], ent.points[i + 1]]);
    }
  });

  const loops: CADPoint[][] = [];
  const visitedEdges = new Set<number>();

  for (let i = 0; i < edges.length; i++) {
    if (visitedEdges.has(i)) continue;

    const currentLoop: CADPoint[] = [edges[i][0], edges[i][1]];
    visitedEdges.add(i);

    let currentEnd = edges[i][1];
    let foundNext = true;

    while (foundNext) {
      foundNext = false;
      if (pointsEqual(currentEnd, currentLoop[0])) {
        // Closed loop formed!
        currentLoop.pop(); // Remove duplicate closing vertex
        if (currentLoop.length >= 3) {
          loops.push(currentLoop);
        }
        break;
      }

      for (let j = 0; j < edges.length; j++) {
        if (visitedEdges.has(j)) continue;

        const [pStart, pEnd] = edges[j];
        if (pointsEqual(currentEnd, pStart)) {
          visitedEdges.add(j);
          currentLoop.push(pEnd);
          currentEnd = pEnd;
          foundNext = true;
          break;
        } else if (pointsEqual(currentEnd, pEnd)) {
          visitedEdges.add(j);
          currentLoop.push(pStart);
          currentEnd = pStart;
          foundNext = true;
          break;
        }
      }
    }
  }

  return loops;
}

/**
 * Extracts window items from window entities.
 */
export function extractWindowsFromEntities(
  entities: CADEntity[],
  targetLayers: string[],
  defaultWindowHeight: number = 1.2
): CADWindowItem[] {
  const targetSet = new Set(targetLayers.map((l) => l.toLowerCase()));
  const filtered = entities.filter((e) => targetSet.has(e.layer.toLowerCase()));

  const windows: CADWindowItem[] = [];

  filtered.forEach((ent, idx) => {
    if (ent.points.length >= 2) {
      const p1 = ent.points[0];
      const p2 = ent.points[1];
      const width = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (width < 0.1) return; // Skip tiny segments

      const center = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      };

      const area = ent.closed && ent.points.length >= 3
        ? calculateShoelaceArea(ent.points)
        : parseFloat((width * defaultWindowHeight).toFixed(2));

      windows.push({
        id: `win-item-${idx}`,
        layer: ent.layer,
        points: ent.points,
        center,
        area: Math.max(0.5, area),
        orientation: 'norte' // Initial default, mapped to wall orientation later
      });
    }
  });

  return windows;
}

/**
 * Distance from point to line segment.
 */
function pointToSegmentDistance(pt: CADPoint, p1: CADPoint, p2: CADPoint): number {
  const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
  if (l2 === 0) return Math.hypot(pt.x - p1.x, pt.y - p1.y);
  let t = ((pt.x - p1.x) * (p2.x - p1.x) + (pt.y - p1.y) * (p2.y - p1.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = p1.x + t * (p2.x - p1.x);
  const projY = p1.y + t * (p2.y - p1.y);
  return Math.hypot(pt.x - projX, pt.y - projY);
}

/**
 * Maps CAD Polygons and Windows into fully calculated `HVACEnvironment` objects.
 */
export function convertCadToHVACEnvironments(
  polygons: CADPolygon[],
  windows: CADWindowItem[],
  config: CADImportConfig
): HVACEnvironment[] {
  return polygons.map((poly, idx) => {
    // 1. Extract wall segments with outward normals and orientations
    const wallSegments = extractWallSegments(poly.points, config.northAngleOffsetDegrees);

    // Group wall areas by cardinal orientation
    const wallAreaMap: Record<Orientation, number> = {
      norte: 0,
      sul: 0,
      leste: 0,
      oeste: 0
    };

    wallSegments.forEach((seg) => {
      const segArea = seg.length * config.defaultHeight;
      wallAreaMap[seg.orientation] += segArea;
    });

    const walls: Wall[] = (Object.keys(wallAreaMap) as Orientation[])
      .filter((orient) => wallAreaMap[orient] > 0)
      .map((orient) => ({
        id: `wall-${idx + 1}-${orient}`,
        area: parseFloat(wallAreaMap[orient].toFixed(2)),
        orientation: orient,
        type: 'alvenaria_leve'
      }));

    // 2. Associate windows with closest wall segment of this polygon
    const polyWindows: CADWindowItem[] = [];
    const maxMatchDistance = 1.5; // Max 1.5 meters proximity

    windows.forEach((win) => {
      let minDist = Infinity;
      let bestOrientation: Orientation = 'norte';

      wallSegments.forEach((seg) => {
        const dist = pointToSegmentDistance(win.center, seg.p1, seg.p2);
        if (dist < minDist) {
          minDist = dist;
          bestOrientation = seg.orientation;
        }
      });

      if (minDist <= maxMatchDistance) {
        polyWindows.push({
          ...win,
          orientation: bestOrientation
        });
      }
    });

    // Group window areas by orientation
    const windowAreaMap: Record<Orientation, number> = {
      norte: 0,
      sul: 0,
      leste: 0,
      oeste: 0
    };

    polyWindows.forEach((win) => {
      windowAreaMap[win.orientation] += win.area;
    });

    const hvacWindows: Window[] = (Object.keys(windowAreaMap) as Orientation[])
      .filter((orient) => windowAreaMap[orient] > 0)
      .map((orient) => ({
        id: `win-${idx + 1}-${orient}`,
        area: parseFloat(windowAreaMap[orient].toFixed(2)),
        orientation: orient,
        glassType: 'simples',
        protection: 0.7
      }));

    const roomArea = parseFloat(poly.area.toFixed(2));
    const occupants = Math.max(1, Math.round(roomArea / 8));
    const lightingWatts = Math.round(roomArea * 15);

    return {
      id: `cad-env-${Date.now()}-${idx + 1}`,
      name: poly.name || `Ambiente ${idx + 1}`,
      area: roomArea,
      height: config.defaultHeight,
      occupants,
      activity: config.defaultActivity || 'comercial_baixo',
      zonaId: config.defaultZonaId || 3,
      lightingWatts,
      hasRoof: true,
      roofType: 'laje_simples',
      roofArea: roomArea,
      walls: walls.length > 0 ? walls : [
        { id: 1, area: parseFloat((Math.sqrt(roomArea) * config.defaultHeight * 2).toFixed(2)), orientation: 'norte', type: 'alvenaria_leve' }
      ],
      windows: hvacWindows,
      equipment: []
    };
  });
}

