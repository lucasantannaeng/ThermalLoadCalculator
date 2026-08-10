import { HVACEnvironment, Orientation, Wall, Window, ActivityType, RoofType, WallType, GlassType, HVACResult, MaterialCatalog } from '../types/hvac';
import { extractWallSegments, mapNormalToOrientation, calculateShoelaceArea } from './cadImporterService';
import { calculateEnvironmentThermalLoad } from '../utils/hvacCalculations';

export interface VectorPoint {
  x: number;
  y: number;
}

export interface VectorWall {
  id: string;
  p1: VectorPoint;
  p2: VectorPoint;
  type: WallType;
  height: number;
}

export interface VectorWindow {
  id: string;
  wallId?: string;
  center: VectorPoint;
  length: number;
  height: number;
  area?: number;
  glassType: GlassType;
  protection: number;
  orientation: Orientation;
}

export interface VectorRoom {
  id: string;
  name: string;
  points: VectorPoint[];
  height: number;
  activity: ActivityType;
  zonaId: number;
  occupants?: number;
  area?: number;
  hasRoof: boolean;
  roofType: RoofType;
  wallType?: WallType;
  glassType?: GlassType;
  lightingWatts: number;
  equipmentWatts?: number;
  customCatalog?: MaterialCatalog;
}

export interface VectorForgeBlock {
  id: string;
  blockId: string;
  name: string;
  category: string;
  center: VectorPoint;
  width: number;
  height: number;
  rotation: number;
  electricPowerWatts: number;
  thermalCapacityBTU: number;
  color?: string;
}

export interface GridSnapOptions {
  enabled: boolean;
  gridSize: number; // e.g. 0.5m or 1.0m
  snapToNodes: boolean;
  nodeSnapRadius: number; // in meters (e.g. 0.3m)
}

/**
 * Snaps a 2D world coordinate to the nearest grid step.
 */
export function snapPointToGrid(p: VectorPoint, gridSize: number, enabled: boolean = true): VectorPoint {
  if (!enabled || gridSize <= 0) return { ...p };
  return {
    x: Math.round(p.x / gridSize) * gridSize,
    y: Math.round(p.y / gridSize) * gridSize,
  };
}

/**
 * Snaps a 2D point to existing vertex nodes if within snapRadius meters.
 */
export function snapPointToNodes(
  p: VectorPoint,
  nodes: VectorPoint[],
  snapRadius: number = 0.3
): VectorPoint {
  let closestNode: VectorPoint | null = null;
  let minDist = snapRadius;

  for (const node of nodes) {
    const dist = Math.hypot(node.x - p.x, node.y - p.y);
    if (dist < minDist) {
      minDist = dist;
      closestNode = node;
    }
  }

  return closestNode ? { ...closestNode } : { ...p };
}

/**
 * Combined snap logic: node snap prioritized, then grid snap.
 */
export function applySnapping(
  p: VectorPoint,
  existingNodes: VectorPoint[],
  options: GridSnapOptions
): VectorPoint {
  if (options.snapToNodes) {
    const nodeSnapped = snapPointToNodes(p, existingNodes, options.nodeSnapRadius);
    if (nodeSnapped.x !== p.x || nodeSnapped.y !== p.y) {
      return nodeSnapped;
    }
  }
  return snapPointToGrid(p, options.gridSize, options.enabled);
}

/**
 * Calculates Euclidean distance between two points in meters.
 */
export function calculateSegmentLength(p1: VectorPoint, p2: VectorPoint): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Calculates segment angle in degrees relative to standard Cartesian grid (-180 to 180).
 */
export function calculateSegmentAngle(p1: VectorPoint, p2: VectorPoint): number {
  return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
}

/**
 * Maps a directed line segment (p1 -> p2) to a cardinal orientation ('norte', 'sul', 'leste', 'oeste').
 * Outward normal is right-hand normal (dy, -dx) relative to line direction.
 */
export function getSegmentOrientation(
  p1: VectorPoint,
  p2: VectorPoint,
  northAngleOffsetDegrees: number = 0
): Orientation {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-5) return 'norte';

  // Right-hand normal (points right of directed vector)
  const nx = dy / len;
  const ny = -dx / len;

  return mapNormalToOrientation({ x: nx, y: ny }, northAngleOffsetDegrees);
}

/**
 * Finds closest point on line segment (p1, p2) to target point pt.
 */
export function findClosestPointOnSegment(
  pt: VectorPoint,
  p1: VectorPoint,
  p2: VectorPoint
): { point: VectorPoint; distance: number; t: number } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    const distance = Math.hypot(pt.x - p1.x, pt.y - p1.y);
    return { point: { ...p1 }, distance, t: 0 };
  }

  let t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;
  const distance = Math.hypot(pt.x - projX, pt.y - projY);

  return {
    point: { x: projX, y: projY },
    distance,
    t,
  };
}

/**
 * Calculates polygon area using Shoelace formula.
 */
export function calculatePolygonArea(points: VectorPoint[]): number {
  return calculateShoelaceArea(points);
}

/**
 * Updates a vertex node across rooms and walls when a node is dragged.
 */
export function updateNodePosition(
  oldNode: VectorPoint,
  newNode: VectorPoint,
  rooms: VectorRoom[],
  walls: VectorWall[],
  tolerance: number = 0.1
): { updatedRooms: VectorRoom[]; updatedWalls: VectorWall[] } {
  const isMatch = (p: VectorPoint) => Math.hypot(p.x - oldNode.x, p.y - oldNode.y) <= tolerance;

  const updatedRooms = rooms.map((room) => ({
    ...room,
    points: room.points.map((pt) => (isMatch(pt) ? { ...newNode } : pt)),
  }));

  const updatedWalls = walls.map((wall) => ({
    ...wall,
    p1: isMatch(wall.p1) ? { ...newNode } : wall.p1,
    p2: isMatch(wall.p2) ? { ...newNode } : wall.p2,
  }));

  return { updatedRooms, updatedWalls };
}

/**
 * Updates a specific vertex of a polygon by index.
 */
export function updatePolygonVertex(
  points: VectorPoint[],
  vertexIndex: number,
  newPoint: VectorPoint
): VectorPoint[] {
  if (vertexIndex < 0 || vertexIndex >= points.length) return points;
  return points.map((pt, idx) => (idx === vertexIndex ? { ...newPoint } : pt));
}

/**
 * Finds a specific node/vertex near a target point across rooms and walls.
 */
export function findVertexNearPoint(
  pt: VectorPoint,
  rooms: VectorRoom[],
  walls: VectorWall[],
  threshold: number = 0.4,
  zoom: number = 30
): {
  type: 'room' | 'wall';
  elementId: string;
  vertexIndex?: number;
  pointKey?: 'p1' | 'p2';
  point: VectorPoint;
} | null {
  const effThreshold = threshold >= 1 ? threshold / zoom : threshold;

  for (const room of rooms) {
    for (let i = 0; i < room.points.length; i++) {
      if (Math.hypot(room.points[i].x - pt.x, room.points[i].y - pt.y) <= effThreshold) {
        return { type: 'room', elementId: room.id, vertexIndex: i, point: room.points[i] };
      }
    }
  }
  for (const wall of walls) {
    if (Math.hypot(wall.p1.x - pt.x, wall.p1.y - pt.y) <= effThreshold) {
      return { type: 'wall', elementId: wall.id, pointKey: 'p1', point: wall.p1 };
    }
    if (Math.hypot(wall.p2.x - pt.x, wall.p2.y - pt.y) <= effThreshold) {
      return { type: 'wall', elementId: wall.id, pointKey: 'p2', point: wall.p2 };
    }
  }
  return null;
}

/**
 * Checks if a 2D world point is inside a ForgeCAD equipment block bounding box.
 */
export function isPointInEquipmentBlock(
  pt: VectorPoint,
  block: VectorForgeBlock,
  padding: number = 0.2
): boolean {
  const dx = pt.x - block.center.x;
  const dy = pt.y - block.center.y;
  const rad = (-block.rotation * Math.PI) / 180;
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
  const halfW = block.width / 2 + padding;
  const halfH = block.height / 2 + padding;
  return Math.abs(rx) <= halfW && Math.abs(ry) <= halfH;
}

/**
 * Updates equipment position.
 */
export function updateEquipmentPosition(
  block: VectorForgeBlock,
  newCenter: VectorPoint,
  rooms?: VectorRoom[]
): VectorForgeBlock {
  if (rooms && rooms.length > 0) {
    const isInsideAnyRoom = rooms.some(r => isPointInPolygon(newCenter, r.points));
    if (!isInsideAnyRoom) {
      console.warn(`Warning: Equipment ${block.id} moved outside all rooms.`);
    }
  }
  return { ...block, center: { ...newCenter } };
}

/**
 * Updates equipment dimensions (width and height).
 */
export function updateEquipmentDimensions(
  block: VectorForgeBlock,
  width: number,
  height: number
): VectorForgeBlock {
  return {
    ...block,
    width: Math.max(0.2, width),
    height: Math.max(0.2, height)
  };
}

/**
 * Granular deletion of individual room, wall, window, or equipment block element.
 */
export function deleteElementFromCanvas(
  target: { type: 'room' | 'wall' | 'window' | 'equipment'; id: string },
  rooms: VectorRoom[],
  walls: VectorWall[],
  windows: VectorWindow[],
  equipments: VectorForgeBlock[] = []
): {
  updatedRooms: VectorRoom[];
  updatedWalls: VectorWall[];
  updatedWindows: VectorWindow[];
  updatedEquipments: VectorForgeBlock[];
} {
  let updatedRooms = rooms;
  let updatedWalls = walls;
  let updatedWindows = windows;
  let updatedEquipments = equipments;

  if (target.type === 'room') {
    updatedRooms = rooms.filter((r) => r.id !== target.id);
    const roomToDelete = rooms.find(r => r.id === target.id);
    if (roomToDelete) {
      updatedEquipments = equipments.filter((e) => !isPointInPolygon(e.center, roomToDelete.points));
      updatedWalls = walls.filter((w) => !(isPointInPolygon(w.p1, roomToDelete.points) && isPointInPolygon(w.p2, roomToDelete.points)));
    }
  } else if (target.type === 'wall') {
    updatedWalls = walls.filter((w) => w.id !== target.id);
    updatedWindows = windows.filter((w) => w.wallId !== target.id);
  } else if (target.type === 'window') {
    updatedWindows = windows.filter((w) => w.id !== target.id);
  } else if (target.type === 'equipment') {
    updatedEquipments = equipments.filter((e) => e.id !== target.id);
  }

  return {
    updatedRooms,
    updatedWalls,
    updatedWindows,
    updatedEquipments,
  };
}

/**
 * Converts Vector Rooms, Walls, Windows, and ForgeCAD Equipment Blocks into HVACEnvironment objects.
 */
export function convertVectorCanvasToHVACEnvironments(
  rooms: VectorRoom[],
  walls: VectorWall[],
  windows: VectorWindow[],
  defaultHeight: number = 2.8,
  equipments: VectorForgeBlock[] = []
): HVACEnvironment[] {
  // If user drew rooms explicitly, build HVACEnvironments from rooms
  if (rooms.length > 0) {
    return rooms.map((room, idx) => {
      const roomArea = parseFloat(calculatePolygonArea(room.points).toFixed(2)) || 25;
      const wallSegments = extractWallSegments(room.points, 0);

      const wallAreaMap: Record<Orientation, number> = { norte: 0, sul: 0, leste: 0, oeste: 0 };
      const height = room.height || defaultHeight;

      wallSegments.forEach((seg) => {
        wallAreaMap[seg.orientation] += seg.length * height;
      });

      const wallTypeToUse = room.wallType || 'alvenaria_leve';

      // Map wall segments into Wall objects
      const envWalls: Wall[] = (Object.keys(wallAreaMap) as Orientation[])
        .filter((orient) => wallAreaMap[orient] > 0)
        .map((orient, wIdx) => ({
          id: `w-${room.id}-${orient}-${wIdx}`,
          area: parseFloat(wallAreaMap[orient].toFixed(2)),
          orientation: orient,
          type: wallTypeToUse,
        }));

      // Match windows to wall orientations
      const windowAreaMap: Record<Orientation, number> = { norte: 0, sul: 0, leste: 0, oeste: 0 };
      
      const roomWindows = windows.filter(win => 
        (win.wallId && envWalls.some(w => w.id === win.wallId)) || 
        isPointInPolygon(win.center, room.points) ||
        (room.points.length > 2 && room.points.some((p1, i) => isPointNearWall(win.center, p1, room.points[(i + 1) % room.points.length], 0.3)))
      );

      roomWindows.forEach((win) => {
        const area: number = (win.area && win.area > 0) ? win.area : parseFloat((win.length * win.height).toFixed(2));
        windowAreaMap[win.orientation] += area;
      });

      const glassTypeToUse = room.glassType || 'simples';

      const envWindows: Window[] = (Object.keys(windowAreaMap) as Orientation[])
        .filter((orient) => wallAreaMap[orient] > 0 || windowAreaMap[orient] > 0)
        .map((orient, winIdx) => {
          const matchingWin = roomWindows.find(w => w.orientation === orient);
          return {
            id: `win-${room.id}-${orient}-${winIdx}`,
            area: parseFloat(windowAreaMap[orient].toFixed(2)),
            orientation: orient,
            glassType: matchingWin?.glassType || glassTypeToUse,
            protection: matchingWin?.protection || 0.7,
          };
        });

      const occupants = room.occupants !== undefined ? room.occupants : Math.max(1, Math.round(roomArea / 8));
      const lightingWatts = room.lightingWatts !== undefined ? room.lightingWatts : Math.round(roomArea * 15);

      // Collect equipment items from room property and ForgeCAD canvas equipment placed inside room
      const placedEquipments = (equipments || []).filter(eq => isPointInPolygon(eq.center, room.points));
      const equipment = [
        ...(room.equipmentWatts && room.equipmentWatts > 0 ? [
          { id: `eq-${room.id}`, name: 'Carga Equipamentos', watts: room.equipmentWatts, qty: 1 }
        ] : []),
        ...placedEquipments.map((eq, eIdx) => ({
          id: eq.id || `forge-eq-${room.id}-${eIdx}`,
          name: eq.name,
          watts: eq.electricPowerWatts || 0,
          qty: 1
        }))
      ];

      return {
        id: room.id || `vector-env-${Date.now()}-${idx + 1}`,
        name: room.name || `Recinto Vetorial ${idx + 1}`,
        area: roomArea,
        height,
        occupants,
        activity: room.activity || 'comercial_baixo',
        zonaId: room.zonaId || 3,
        lightingWatts,
        hasRoof: room.hasRoof !== undefined ? room.hasRoof : true,
        roofType: room.roofType || 'laje_simples',
        roofArea: roomArea,
        walls: envWalls.length > 0 ? envWalls : [
          { id: 1, area: parseFloat((Math.sqrt(roomArea) * height * 2).toFixed(2)), orientation: 'norte', type: wallTypeToUse }
        ],
        windows: envWindows,
        equipment,
        customCatalog: room.customCatalog
      };
    });
  }

  // If no rooms drawn, but walls were drawn, synthesize a room from walls Bounding Box
  if (walls.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    walls.forEach((w) => {
      minX = Math.min(minX, w.p1.x, w.p2.x);
      minY = Math.min(minY, w.p1.y, w.p2.y);
      maxX = Math.max(maxX, w.p1.x, w.p2.x);
      maxY = Math.max(maxY, w.p1.y, w.p2.y);
    });

    const width = Math.max(1, maxX - minX);
    const length = Math.max(1, maxY - minY);
    const roomArea = parseFloat((width * length).toFixed(2));

    const wallAreaMap: Record<Orientation, number> = { norte: 0, sul: 0, leste: 0, oeste: 0 };
    walls.forEach((w) => {
      const orient = getSegmentOrientation(w.p1, w.p2, 0);
      const len = calculateSegmentLength(w.p1, w.p2);
      wallAreaMap[orient] += len * w.height;
    });

    const defaultWallType = walls[0]?.type || 'alvenaria_leve';

    const envWalls: Wall[] = (Object.keys(wallAreaMap) as Orientation[])
      .filter((orient) => wallAreaMap[orient] > 0)
      .map((orient, wIdx) => ({
        id: `wall-synth-${wIdx}`,
        area: parseFloat(wallAreaMap[orient].toFixed(2)),
        orientation: orient,
        type: defaultWallType,
      }));

    const windowAreaMap: Record<Orientation, number> = { norte: 0, sul: 0, leste: 0, oeste: 0 };
    windows.forEach((win) => {
      const area: number = (win.area && win.area > 0) ? win.area : parseFloat((win.length * win.height).toFixed(2));
      windowAreaMap[win.orientation] += area;
    });

    const defaultGlassType = windows[0]?.glassType || 'simples';

    const envWindows: Window[] = (Object.keys(windowAreaMap) as Orientation[])
      .filter((orient) => wallAreaMap[orient] > 0)
      .map((orient, winIdx) => ({
        id: `win-synth-${winIdx}`,
        area: parseFloat(windowAreaMap[orient].toFixed(2)),
        orientation: orient,
        glassType: defaultGlassType,
        protection: 0.7,
      }));

    const equipment = (equipments || []).map((eq, eIdx) => ({
      id: eq.id || `forge-eq-synth-${eIdx}`,
      name: eq.name,
      watts: eq.electricPowerWatts || 0,
      qty: 1
    }));

    return [
      {
        id: `vector-env-walls-${Date.now()}`,
        name: 'Recinto Vetorial Parede',
        area: roomArea,
        height: defaultHeight,
        occupants: Math.max(1, Math.round(roomArea / 8)),
        activity: 'comercial_baixo',
        zonaId: 3,
        lightingWatts: Math.round(roomArea * 15),
        hasRoof: true,
        roofType: 'laje_simples',
        roofArea: roomArea,
        walls: envWalls,
        windows: envWindows,
        equipment,
      },
    ];
  }

  return [];
}

/**
 * Calculates real-time thermal load (Q_total in BTU/h and kW) for a 2D Vector Room.
 */
export function calculateRoomThermalLoad(
  room: VectorRoom,
  allWalls: VectorWall[] = [],
  allWindows: VectorWindow[] = [],
  customCatalog?: MaterialCatalog,
  equipments: VectorForgeBlock[] = []
): HVACResult {
  const roomToCalc = customCatalog ? { ...room, customCatalog } : room;
  const envs = convertVectorCanvasToHVACEnvironments([roomToCalc], allWalls, allWindows, room.height, equipments);
  if (envs.length > 0) {
    const env = envs[0];
    if (customCatalog) env.customCatalog = customCatalog;
    return calculateEnvironmentThermalLoad(env);
  }

  const area = parseFloat(calculatePolygonArea(room.points).toFixed(2)) || 25;
  const fallbackEnv: HVACEnvironment = {
    id: room.id,
    name: room.name,
    area,
    height: room.height || 2.8,
    occupants: room.occupants !== undefined ? room.occupants : Math.max(1, Math.round(area / 8)),
    activity: room.activity || 'comercial_baixo',
    zonaId: room.zonaId || 3,
    lightingWatts: room.lightingWatts !== undefined ? room.lightingWatts : Math.round(area * 15),
    hasRoof: room.hasRoof !== undefined ? room.hasRoof : true,
    roofType: room.roofType || 'laje_simples',
    roofArea: area,
    walls: [
      { id: 1, area: parseFloat((Math.sqrt(area) * (room.height || 2.8) * 4).toFixed(2)), orientation: 'norte', type: room.wallType || 'alvenaria_leve' }
    ],
    windows: [],
    equipment: room.equipmentWatts && room.equipmentWatts > 0 ? [{ id: 1, name: 'Equipamentos', watts: room.equipmentWatts, qty: 1 }] : [],
    customCatalog
  };
  return calculateEnvironmentThermalLoad(fallbackEnv);
}

/**
 * Checks if a 2D world point is inside a polygon using ray-casting algorithm.
 */
export function isPointInPolygon(pt: VectorPoint, poly: VectorPoint[]): boolean {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Checks if a point is within threshold distance (in meters) of a wall segment.
 */
export function isPointNearWall(
  pt: VectorPoint,
  p1: VectorPoint,
  p2: VectorPoint,
  threshold: number = 0.3,
  zoom: number = 30
): boolean {
  const effThreshold = threshold >= 1 ? threshold / zoom : threshold;
  const proj = findClosestPointOnSegment(pt, p1, p2);
  return proj.distance <= effThreshold;
}

/**
 * Checks if a point is within threshold distance (in meters) of a window center.
 */
export function isPointNearWindow(
  pt: VectorPoint,
  center: VectorPoint,
  threshold: number = 0.6,
  zoom: number = 30
): boolean {
  const effThreshold = threshold >= 1 ? threshold / zoom : threshold;
  return Math.hypot(center.x - pt.x, center.y - pt.y) <= effThreshold;
}

/**
 * Converts screen client coordinates (clientX, clientY) to internal canvas buffer pixel coordinates.
 * Accounts for canvas bounding box offset and CSS scaling factor (rect vs canvas width/height).
 */
export function getCanvasMousePosition(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const scaleX = rect.width > 0 ? canvasWidth / rect.width : 1;
  const scaleY = rect.height > 0 ? canvasHeight / rect.height : 1;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

/**
 * Converts internal screen pixels to world coordinates (meters).
 */
export function screenToWorld(
  screenPt: { x: number; y: number },
  panOffset: { x: number; y: number },
  zoom: number
): VectorPoint {
  const safeZoom = zoom <= 0 ? 1 : zoom;
  return {
    x: (screenPt.x - panOffset.x) / safeZoom,
    y: (screenPt.y - panOffset.y) / safeZoom,
  };
}

/**
 * Converts world coordinates (meters) to internal screen pixels.
 */
export function worldToScreen(
  worldPt: VectorPoint,
  panOffset: { x: number; y: number },
  zoom: number
): { x: number; y: number } {
  return {
    x: worldPt.x * zoom + panOffset.x,
    y: worldPt.y * zoom + panOffset.y,
  };
}

/**
 * Calculates new panOffset so that the world coordinate under the cursor remains at the same screen position after zoom change.
 */
export function calculateZoomPanToMouse(
  mouseScreen: { x: number; y: number },
  currentPan: { x: number; y: number },
  currentZoom: number,
  newZoom: number
): { x: number; y: number } {
  const worldX = (mouseScreen.x - currentPan.x) / currentZoom;
  const worldY = (mouseScreen.y - currentPan.y) / currentZoom;

  return {
    x: mouseScreen.x - worldX * newZoom,
    y: mouseScreen.y - worldY * newZoom,
  };
}


