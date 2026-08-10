import { describe, it, expect } from 'vitest';
import {
  snapPointToGrid,
  snapPointToNodes,
  applySnapping,
  calculateSegmentLength,
  calculateSegmentAngle,
  getSegmentOrientation,
  findClosestPointOnSegment,
  calculatePolygonArea,
  updateNodePosition,
  updatePolygonVertex,
  findVertexNearPoint,
  isPointInEquipmentBlock,
  updateEquipmentPosition,
  updateEquipmentDimensions,
  deleteElementFromCanvas,
  convertVectorCanvasToHVACEnvironments,
  calculateRoomThermalLoad,
  isPointInPolygon,
  isPointNearWall,
  isPointNearWindow,
  getCanvasMousePosition,
  screenToWorld,
  worldToScreen,
  calculateZoomPanToMouse,
  VectorPoint,
  VectorWall,
  VectorWindow,
  VectorRoom,
  VectorForgeBlock,
  GridSnapOptions
} from '../services/vectorEditorService';

describe('Vector Canvas Editor Service (Math, Snapping, Node Editing & HVAC Conversion)', () => {

  describe('1. Snapping Math & Grid Systems', () => {
    it('snaps points to nearest grid increments', () => {
      const p1: VectorPoint = { x: 1.23, y: 4.87 };
      const snapped05 = snapPointToGrid(p1, 0.5, true);
      expect(snapped05.x).toBe(1.0);
      expect(snapped05.y).toBe(5.0);

      const snapped10 = snapPointToGrid(p1, 1.0, true);
      expect(snapped10.x).toBe(1.0);
      expect(snapped10.y).toBe(5.0);

      const disabled = snapPointToGrid(p1, 0.5, false);
      expect(disabled.x).toBe(1.23);
      expect(disabled.y).toBe(4.87);
    });

    it('snaps points to existing vertex nodes within snap radius', () => {
      const nodes: VectorPoint[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 6 },
        { x: 0, y: 6 }
      ];

      const cursorNearNode: VectorPoint = { x: 9.95, y: 0.08 };
      const nodeSnapped = snapPointToNodes(cursorNearNode, nodes, 0.3);
      expect(nodeSnapped.x).toBe(10);
      expect(nodeSnapped.y).toBe(0);

      const cursorFarFromNodes: VectorPoint = { x: 5.0, y: 3.0 };
      const noNodeSnap = snapPointToNodes(cursorFarFromNodes, nodes, 0.3);
      expect(noNodeSnap.x).toBe(5.0);
      expect(noNodeSnap.y).toBe(3.0);
    });

    it('prioritizes node snapping over grid snapping in applySnapping', () => {
      const nodes: VectorPoint[] = [{ x: 5.12, y: 2.94 }];
      const cursor: VectorPoint = { x: 5.10, y: 2.95 };
      const options: GridSnapOptions = {
        enabled: true,
        gridSize: 1.0,
        snapToNodes: true,
        nodeSnapRadius: 0.3
      };

      const result = applySnapping(cursor, nodes, options);
      expect(result.x).toBe(5.12);
      expect(result.y).toBe(2.94);
    });
  });

  describe('2. Line Segment Geometry & Orientation Mapping', () => {
    it('calculates segment lengths and angles correctly', () => {
      const p1: VectorPoint = { x: 0, y: 0 };
      const p2: VectorPoint = { x: 6, y: 8 };

      expect(calculateSegmentLength(p1, p2)).toBe(10);
      expect(calculateSegmentAngle(p1, p2)).toBeCloseTo(53.13, 2);
    });

    it('maps directed line segment outward normals to cardinal orientations', () => {
      // Horizontal segment left -> right: (0,0) -> (10,0)
      // Right hand normal points down (-Y) => 'sul'
      expect(getSegmentOrientation({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe('sul');

      // Horizontal segment right -> left: (10,0) -> (0,0)
      // Right hand normal points up (+Y) => 'norte'
      expect(getSegmentOrientation({ x: 10, y: 0 }, { x: 0, y: 0 })).toBe('norte');

      // Vertical segment bottom -> top: (0,0) -> (0,10)
      // Right hand normal points right (+X) => 'leste'
      expect(getSegmentOrientation({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe('leste');

      // Vertical segment top -> bottom: (0,10) -> (0,0)
      // Right hand normal points left (-X) => 'oeste'
      expect(getSegmentOrientation({ x: 0, y: 10 }, { x: 0, y: 0 })).toBe('oeste');
    });

    it('finds closest point on segment to a cursor target', () => {
      const p1: VectorPoint = { x: 0, y: 0 };
      const p2: VectorPoint = { x: 10, y: 0 };
      const target: VectorPoint = { x: 4.5, y: 3.0 };

      const proj = findClosestPointOnSegment(target, p1, p2);
      expect(proj.point.x).toBe(4.5);
      expect(proj.point.y).toBe(0);
      expect(proj.distance).toBe(3.0);
      expect(proj.t).toBe(0.45);
    });
  });

  describe('3. Real-time Area & Node Editing', () => {
    it('calculates polygon area using Shoelace formula', () => {
      const roomPoints: VectorPoint[] = [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 5 },
        { x: 0, y: 5 }
      ];

      expect(calculatePolygonArea(roomPoints)).toBe(40);
    });

    it('updates node positions across connected rooms and walls when dragged', () => {
      const oldVertex: VectorPoint = { x: 8, y: 5 };
      const newVertex: VectorPoint = { x: 9, y: 6 };

      const rooms: VectorRoom[] = [
        {
          id: 'room-1',
          name: 'Sala Vetorial',
          points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5 }, { x: 0, y: 5 }],
          height: 2.8,
          activity: 'comercial_baixo',
          zonaId: 3,
          hasRoof: true,
          roofType: 'laje_simples',
          lightingWatts: 600
        }
      ];

      const walls: VectorWall[] = [
        { id: 'wall-1', p1: { x: 8, y: 0 }, p2: { x: 8, y: 5 }, type: 'alvenaria_leve', height: 2.8 }
      ];

      const { updatedRooms, updatedWalls } = updateNodePosition(oldVertex, newVertex, rooms, walls, 0.1);

      expect(updatedRooms[0].points[2]).toEqual(newVertex);
      expect(updatedWalls[0].p2).toEqual(newVertex);
      expect(calculatePolygonArea(updatedRooms[0].points)).toBe(46.5);
    });
  });

  describe('4. HVACEnvironment Conversion', () => {
    it('converts vector room polygon, walls, and windows into valid HVACEnvironment objects', () => {
      const rooms: VectorRoom[] = [
        {
          id: 'room-vector-1',
          name: 'Auditório Vetorial',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 6 },
            { x: 0, y: 6 }
          ],
          height: 3.0,
          activity: 'comercial_alto',
          zonaId: 3,
          hasRoof: true,
          roofType: 'laje_isolada',
          lightingWatts: 900
        }
      ];

      const windows: VectorWindow[] = [
        {
          id: 'win-1',
          center: { x: 5, y: 6 },
          length: 3.0,
          height: 1.5,
          area: 4.5,
          glassType: 'duplo',
          protection: 0.6,
          orientation: 'norte'
        }
      ];

      const environments = convertVectorCanvasToHVACEnvironments(rooms, [], windows, 3.0);

      expect(environments).toHaveLength(1);
      const env = environments[0];

      expect(env.id).toBe('room-vector-1');
      expect(env.name).toBe('Auditório Vetorial');
      expect(env.area).toBe(60);
      expect(env.height).toBe(3.0);
      expect(env.occupants).toBe(8); // 60 / 8 = 7.5 => 8
      expect(env.lightingWatts).toBe(900);
      expect(env.walls.length).toBeGreaterThan(0);

      const northWin = env.windows.find(w => w.orientation === 'norte');
      expect(northWin).toBeDefined();
      expect(northWin?.area).toBe(4.5);
    });

    it('synthesizes HVACEnvironment from wall segments if no room polygon is drawn', () => {
      const walls: VectorWall[] = [
        { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 8, y: 0 }, type: 'alvenaria_leve', height: 2.8 },
        { id: 'w2', p1: { x: 8, y: 0 }, p2: { x: 8, y: 5 }, type: 'alvenaria_pesada', height: 2.8 },
        { id: 'w3', p1: { x: 8, y: 5 }, p2: { x: 0, y: 5 }, type: 'alvenaria_leve', height: 2.8 },
        { id: 'w4', p1: { x: 0, y: 5 }, p2: { x: 0, y: 0 }, type: 'alvenaria_pesada', height: 2.8 }
      ];

      const environments = convertVectorCanvasToHVACEnvironments([], walls, [], 2.8);

      expect(environments).toHaveLength(1);
      expect(environments[0].area).toBe(40); // 8 * 5 = 40
      expect(environments[0].walls.length).toBeGreaterThan(0);
    });
  });

  describe('5. Real-Time Thermal Load & Material Integration', () => {
    it('calculates real-time Q_total in BTU/h and kW for a vector room', () => {
      const room: VectorRoom = {
        id: 'room-calc-1',
        name: 'Sala Teste Carga',
        points: [
          { x: 0, y: 0 },
          { x: 8, y: 0 },
          { x: 8, y: 5 },
          { x: 0, y: 5 }
        ],
        height: 2.8,
        activity: 'comercial_baixo',
        zonaId: 3,
        hasRoof: true,
        roofType: 'laje_simples',
        wallType: 'alvenaria_leve',
        lightingWatts: 450
      };

      const res = calculateRoomThermalLoad(room, [], []);
      expect(res.total).toBeGreaterThan(0);
      expect(res.potenciaEstimadaKW).toBeGreaterThan(0);
      expect(res.sugerida).toBeTruthy();
    });

    it('updates thermal load when layer materials change (e.g. insulated roof vs simple roof)', () => {
      const baseRoom: VectorRoom = {
        id: 'room-mat-1',
        name: 'Sala Comparativo Materiais',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ],
        height: 3.0,
        activity: 'comercial_baixo',
        zonaId: 3,
        hasRoof: true,
        roofType: 'telha_fibro',
        wallType: 'alvenaria_leve',
        lightingWatts: 1500
      };

      const highLoadRes = calculateRoomThermalLoad(baseRoom, [], []);

      const insulatedRoom: VectorRoom = {
        ...baseRoom,
        roofType: 'laje_isolada',
        wallType: 'drywall_isolado'
      };

      const lowLoadRes = calculateRoomThermalLoad(insulatedRoom, [], []);

      expect(highLoadRes.total).toBeGreaterThan(lowLoadRes.total);
    });
  });

  describe('6. Canvas Coordinate Conversion & Zoom-to-Mouse Physics', () => {
    it('calculates canvas pixel coordinates taking bounding rect and scaling into account', () => {
      const rect = { left: 100, top: 50, width: 800, height: 400 };
      const canvasWidth = 1600; // 2x CSS scale
      const canvasHeight = 800;

      // Mouse at (300, 150) in viewport space
      const pos = getCanvasMousePosition(300, 150, rect, canvasWidth, canvasHeight);
      expect(pos.x).toBe((300 - 100) * 2); // 400 canvas pixels
      expect(pos.y).toBe((150 - 50) * 2);  // 200 canvas pixels
    });

    it('converts between screen pixels and world meters bidirectionally', () => {
      const panOffset = { x: 200, y: 150 };
      const zoom = 40; // 40 px/m

      const worldPt: VectorPoint = { x: 5, y: 3 };
      const screenPt = worldToScreen(worldPt, panOffset, zoom);
      expect(screenPt.x).toBe(5 * 40 + 200); // 400
      expect(screenPt.y).toBe(3 * 40 + 150); // 270

      const convertedWorld = screenToWorld(screenPt, panOffset, zoom);
      expect(convertedWorld.x).toBeCloseTo(5, 5);
      expect(convertedWorld.y).toBeCloseTo(3, 5);
    });

    it('keeps the world point under the cursor stationary during zoom variation (Zoom-to-Mouse)', () => {
      const mouseScreen = { x: 500, y: 300 };
      const initialPan = { x: 100, y: 100 };
      const oldZoom = 30;
      const newZoom = 45;

      // World point under cursor before zoom
      const initialWorldPoint = screenToWorld(mouseScreen, initialPan, oldZoom);

      // Calculate new pan offset for newZoom
      const newPan = calculateZoomPanToMouse(mouseScreen, initialPan, oldZoom, newZoom);

      // Screen position of the same world point after zoom change
      const newScreenPos = worldToScreen(initialWorldPoint, newPan, newZoom);

      expect(newScreenPos.x).toBeCloseTo(mouseScreen.x, 5);
      expect(newScreenPos.y).toBeCloseTo(mouseScreen.y, 5);
    });
  });

  describe('7. 2D Object Selection & Ray-Casting Proximity', () => {
    const polygon: VectorPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 6 },
      { x: 0, y: 6 }
    ];

    it('accurately identifies points inside and outside a room polygon using ray-casting', () => {
      expect(isPointInPolygon({ x: 5, y: 3 }, polygon)).toBe(true);
      expect(isPointInPolygon({ x: 1, y: 1 }, polygon)).toBe(true);
      expect(isPointInPolygon({ x: 12, y: 3 }, polygon)).toBe(false);
      expect(isPointInPolygon({ x: 5, y: -1 }, polygon)).toBe(false);
    });

    it('detects proximity to wall segments within threshold distance', () => {
      const p1: VectorPoint = { x: 0, y: 0 };
      const p2: VectorPoint = { x: 10, y: 0 };

      // Point near wall segment (distance 0.2m <= 0.3m threshold)
      expect(isPointNearWall({ x: 5, y: 0.2 }, p1, p2, 0.3)).toBe(true);

      // Point far from wall segment (distance 1.5m > 0.3m threshold)
      expect(isPointNearWall({ x: 5, y: 1.5 }, p1, p2, 0.3)).toBe(false);
    });

    it('detects proximity to window centers within threshold radius', () => {
      const windowCenter: VectorPoint = { x: 4, y: 5 };

      // Near window center (0.4m <= 0.6m threshold)
      expect(isPointNearWindow({ x: 4.2, y: 5.3 }, windowCenter, 0.6)).toBe(true);

      // Far from window center (1.2m > 0.6m threshold)
      expect(isPointNearWindow({ x: 5.2, y: 5.0 }, windowCenter, 0.6)).toBe(false);
    });
  });
});

