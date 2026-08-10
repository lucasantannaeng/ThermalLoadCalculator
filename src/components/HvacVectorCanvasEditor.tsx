import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  MousePointer,
  Pencil,
  Square,
  Maximize2,
  Move,
  Grid,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  Check,
  Plus,
  Compass,
  Sliders,
  Building2,
  Eye,
  Layers,
  Sparkles,
  Zap,
  Info,
  ShieldCheck,
  Box
} from 'lucide-react';
import {
  HVACEnvironment,
  Orientation,
  WallType,
  GlassType,
  RoofType,
  ActivityType,
  MaterialCatalog
} from '../types/hvac';
import {
  CADParseResult,
  CADPolygon,
  CADWindowItem
} from '../types/cad';
import {
  VectorPoint,
  VectorWall,
  VectorWindow,
  VectorRoom,
  VectorForgeBlock,
  GridSnapOptions,
  applySnapping,
  calculateSegmentLength,
  calculatePolygonArea,
  getSegmentOrientation,
  findClosestPointOnSegment,
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
  calculateZoomPanToMouse
} from '../services/vectorEditorService';
import { HVAC_BLOCK_LIBRARY, getHvacBlockById, HvacBlockDefinition } from '../services/forgeCadService';
import { EXTENDED_ZONAS_BIOCLIMATICAS, PAREDE_MATERIAIS, TELHADO_MATERIAIS, VIDRO_MATERIAIS } from '../data/hvacPresets';
import { defaultMaterialService } from '../services/materialService';

export type ToolMode = 'select' | 'wall' | 'room' | 'window' | 'equipment' | 'pan';

export interface HvacVectorCanvasEditorProps {
  onExportEnvironments?: (environments: HVACEnvironment[], mode: 'append' | 'replace') => void;
  initialEnvironments?: HVACEnvironment[];

  // CAD Import Modal Preview Props (optional)
  parseResult?: CADParseResult | null;
  polygons?: CADPolygon[];
  windows?: CADWindowItem[];
  wallLayers?: string[];
  windowLayers?: string[];
  hoveredPoly?: CADPolygon | null;
  selectedPolyId?: string | null;
  northAngleOffset?: number;
  onHoverPoly?: (poly: CADPolygon | null) => void;
  onSelectPolyId?: (id: string | null) => void;
}

export const HvacVectorCanvasEditor: React.FC<HvacVectorCanvasEditorProps> = React.memo(({
  onExportEnvironments,
  initialEnvironments,
  polygons: cadPolygons,
  windows: cadWindows,
  selectedPolyId,
  onSelectPolyId,
  onHoverPoly
}) => {
  // Materials Catalog State
  const [materialsCatalog, setMaterialsCatalog] = useState<MaterialCatalog>(() => ({
    paredes: Object.values(PAREDE_MATERIAIS),
    telhados: Object.values(TELHADO_MATERIAIS),
    vidros: Object.values(VIDRO_MATERIAIS),
  }));

  useEffect(() => {
    defaultMaterialService.getCatalog().then(cat => {
      if (cat && cat.paredes && cat.paredes.length > 0) {
        setMaterialsCatalog(cat);
      }
    }).catch(console.error);
  }, []);

  // Tool & Canvas Modes
  const [activeTool, setActiveTool] = useState<ToolMode>('select');
  const [selectedBlockTemplate, setSelectedBlockTemplate] = useState<string>('split_evap_24000btu');
  const [gridOptions, setGridOptions] = useState<GridSnapOptions>({
    enabled: true,
    gridSize: 0.5, // meters
    snapToNodes: true,
    nodeSnapRadius: 0.3
  });

  // Canvas Viewport Transforms (World in meters -> Screen in pixels)
  const [zoom, setZoom] = useState<number>(30); // pixels per meter
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 150, y: 150 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Vector Geometry Elements
  const [rooms, setRooms] = useState<VectorRoom[]>(() => {
    if (cadPolygons && cadPolygons.length > 0) {
      return cadPolygons.map((poly, idx) => ({
        id: poly.id || `cad-room-${idx}`,
        name: poly.name || `Ambiente ${idx + 1}`,
        points: poly.points,
        height: 2.8,
        activity: 'comercial_baixo',
        zonaId: 3,
        hasRoof: true,
        roofType: 'laje_simples',
        lightingWatts: Math.round(poly.area * 15)
      }));
    }
    return [
      {
        id: 'room-1',
        name: 'Sala de Reunião Canvas 2D',
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
        lightingWatts: 450
      }
    ];
  });

  const [walls, setWalls] = useState<VectorWall[]>([]);
  const [windows, setWindows] = useState<VectorWindow[]>(() => {
    if (cadWindows && cadWindows.length > 0) {
      return cadWindows.map((cw, idx) => ({
        id: cw.id || `cad-win-${idx}`,
        center: cw.center,
        length: 2.0,
        height: 1.5,
        area: cw.area,
        glassType: 'simples',
        protection: 0.7,
        orientation: cw.orientation
      }));
    }
    return [
      {
        id: 'win-1',
        center: { x: 4, y: 5 },
        length: 2.5,
        height: 1.5,
        area: 3.75,
        glassType: 'simples',
        protection: 0.6,
        orientation: 'norte'
      }
    ];
  });

  // ForgeCAD Equipment Blocks State
  const [equipments, setEquipments] = useState<VectorForgeBlock[]>(() => [
    {
      id: 'eq-block-1',
      blockId: 'split_evap_24000btu',
      name: 'Evaporadora Split 24K',
      category: 'split_evap',
      center: { x: 4, y: 2.5 },
      width: 1.1,
      height: 0.35,
      rotation: 0,
      electricPowerWatts: 2100,
      thermalCapacityBTU: 24000,
      color: '#3b82f6'
    }
  ]);

  // Active Drawing States
  const [drawingPoints, setDrawingPoints] = useState<VectorPoint[]>([]);
  const [cursorWorld, setCursorWorld] = useState<VectorPoint>({ x: 0, y: 0 });

  // Granular Selection & Node Dragging States
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(selectedPolyId || 'room-1');
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<VectorPoint | null>(null);
  const [draggedTarget, setDraggedTarget] = useState<{
    type: 'room_vertex' | 'wall_node' | 'equipment_center';
    id: string;
    vertexIndex?: number;
    pointKey?: 'p1' | 'p2';
  } | null>(null);

  // Sync prop selectedPolyId if passed
  useEffect(() => {
    if (selectedPolyId !== undefined) {
      setSelectedRoomId(selectedPolyId);
    }
  }, [selectedPolyId]);

  // Sync cadPolygons prop if passed later
  useEffect(() => {
    if (cadPolygons && cadPolygons.length > 0) {
      setRooms(cadPolygons.map((poly, idx) => ({
        id: poly.id || `cad-room-${idx}`,
        name: poly.name || `Ambiente ${idx + 1}`,
        points: poly.points,
        height: 2.8,
        activity: 'comercial_baixo',
        zonaId: 3,
        hasRoof: true,
        roofType: 'laje_simples',
        lightingWatts: Math.round(poly.area * 15)
      })));
    }
  }, [cadPolygons]);

  // Notification / Feedback State
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const notifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const showNotify = useCallback((message: string, type: 'success' | 'info' = 'info') => {
    if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current);
    setNotification({ message, type });
    notifyTimeoutRef.current = setTimeout(() => setNotification(null), 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current);
    };
  }, []);

  // Convert Screen Coordinates (pixels) to World Coordinates (meters)
  const screenToWorld = useCallback((screenX: number, screenY: number): VectorPoint => {
    return {
      x: (screenX - panOffset.x) / zoom,
      y: (screenY - panOffset.y) / zoom
    };
  }, [panOffset, zoom]);

  // Convert World Coordinates (meters) to Screen Coordinates (pixels)
  const worldToScreen = useCallback((worldX: number, worldY: number): { x: number; y: number } => {
    return {
      x: worldX * zoom + panOffset.x,
      y: worldY * zoom + panOffset.y
    };
  }, [panOffset, zoom]);

  // Collect all vertex nodes for snapping & interaction
  const allNodes = useMemo(() => {
    const nodes: VectorPoint[] = [];
    rooms.forEach(r => r.points.forEach(p => nodes.push(p)));
    walls.forEach(w => { nodes.push(w.p1); nodes.push(w.p2); });
    windows.forEach(w => nodes.push(w.center));
    equipments.forEach(e => nodes.push(e.center));
    return nodes;
  }, [rooms, walls, windows, equipments]);

  // Calculate Total Floorplan Area
  const totalFloorArea = useMemo(() => {
    return rooms.reduce((acc, r) => acc + calculatePolygonArea(r.points), 0);
  }, [rooms]);

  // Draw Canvas Graphics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset viewport canvas dimension to container
    const parent = canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const targetW = Math.floor(rect.width);
        const targetH = Math.floor(rect.height);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
      }
    }

    const width = canvas.width;
    const height = canvas.height;

    // Clear Canvas Background
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Lines (Sub-grid and Main Grid)
    if (gridOptions.enabled) {
      const stepPx = gridOptions.gridSize * zoom;
      const startX = panOffset.x % stepPx;
      const startY = panOffset.y % stepPx;

      ctx.lineWidth = 1;

      // Sub-grid
      ctx.strokeStyle = '#161e2e';
      ctx.beginPath();
      for (let x = startX; x < width; x += stepPx) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = startY; y < height; y += stepPx) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Main 5m Grid Accent Lines
      const mainStepPx = stepPx * 5;
      const mainStartX = panOffset.x % mainStepPx;
      const mainStartY = panOffset.y % mainStepPx;
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      for (let x = mainStartX; x < width; x += mainStepPx) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = mainStartY; y < height; y += mainStepPx) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    // Draw Origin Axes (0,0)
    const originScreen = worldToScreen(0, 0);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(originScreen.x, 0);
    ctx.lineTo(originScreen.x, height);
    ctx.moveTo(0, originScreen.y);
    ctx.lineTo(width, originScreen.y);
    ctx.stroke();

    // 1. Draw Rooms (Polygons)
    rooms.forEach(room => {
      if (room.points.length < 3) return;
      const isSelected = room.id === selectedRoomId;

      ctx.beginPath();
      const firstScreen = worldToScreen(room.points[0].x, room.points[0].y);
      ctx.moveTo(firstScreen.x, firstScreen.y);

      for (let i = 1; i < room.points.length; i++) {
        const ptScreen = worldToScreen(room.points[i].x, room.points[i].y);
        ctx.lineTo(ptScreen.x, ptScreen.y);
      }
      ctx.closePath();

      // Fill Room Area
      ctx.fillStyle = isSelected ? 'rgba(6, 182, 212, 0.25)' : 'rgba(6, 182, 212, 0.12)';
      ctx.fill();

      // Room Border
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeStyle = isSelected ? '#06b6d4' : '#0284c7';
      ctx.stroke();

      // Draw Interactive Polygon Vertex Handles if room is selected
      if (isSelected) {
        room.points.forEach((pt) => {
          const vpScreen = worldToScreen(pt.x, pt.y);
          ctx.fillStyle = '#06b6d4';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(vpScreen.x, vpScreen.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }

      // Render Room Label, Area & Real-Time Q_total (BTU/h e kW) in Center
      const area = calculatePolygonArea(room.points);
      let cx = 0, cy = 0;
      room.points.forEach(p => { cx += p.x; cy += p.y; });
      cx /= room.points.length; cy /= room.points.length;

      const centerScreen = worldToScreen(cx, cy);

      // Real-time thermal load calculation
      const thermalRes = calculateRoomThermalLoad(room, walls, windows, materialsCatalog, equipments);
      const btuVal = thermalRes.total;
      const kwVal = (btuVal * 0.000293071).toFixed(2);

      const cardW = Math.max(150, room.name.length * 7.5);
      const cardH = 50;
      const cardX = centerScreen.x - cardW / 2;
      const cardY = centerScreen.y - cardH / 2;

      ctx.fillStyle = isSelected ? 'rgba(15, 23, 42, 0.92)' : 'rgba(15, 23, 42, 0.82)';
      ctx.strokeStyle = isSelected ? '#06b6d4' : '#334155';
      ctx.lineWidth = isSelected ? 1.5 : 1;

      if ('roundRect' in ctx && typeof (ctx as any).roundRect === 'function') {
        ctx.beginPath();
        (ctx as any).roundRect(cardX, cardY, cardW, cardH, 8);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeRect(cardX, cardY, cardW, cardH);
      }

      // Line 1: Room Name
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(room.name, centerScreen.x, cardY + 14);

      // Line 2: Area
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${area.toFixed(2)} m²`, centerScreen.x, cardY + 27);

      // Line 3: Q_total (BTU/h e kW)
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`⚡ ${btuVal.toLocaleString('pt-BR')} BTU/h (${kwVal} kW)`, centerScreen.x, cardY + 41);
    });

    // 2. Draw Standalone Walls
    walls.forEach(w => {
      const isSelected = w.id === selectedWallId;
      const s1 = worldToScreen(w.p1.x, w.p1.y);
      const s2 = worldToScreen(w.p2.x, w.p2.y);

      ctx.lineWidth = isSelected ? 5 : 3.5;
      ctx.strokeStyle = isSelected ? '#ec4899' : '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();

      if (isSelected) {
        [s1, s2].forEach(s => {
          ctx.fillStyle = '#ec4899';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }

      // Wall Length Label at midpoint
      const len = calculateSegmentLength(w.p1, w.p2);
      const mx = (s1.x + s2.x) / 2;
      const my = (s1.y + s2.y) / 2;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${len.toFixed(2)} m`, mx, my - 6);
    });

    // 3. Draw Windows
    windows.forEach(win => {
      const isSelected = win.id === selectedWindowId;
      const sc = worldToScreen(win.center.x, win.center.y);
      const winPx = Math.max(12, win.length * zoom);

      ctx.fillStyle = isSelected ? '#f59e0b' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, isSelected ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Window Opening Graphic Box
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(sc.x - winPx / 2, sc.y - 4, winPx, 8);

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Janela (${win.orientation})`, sc.x, sc.y - 8);
    });

    // 4. Draw ForgeCAD Equipment Blocks
    equipments.forEach(eq => {
      const isSelected = eq.id === selectedEquipmentId;
      const sc = worldToScreen(eq.center.x, eq.center.y);
      const wPx = Math.max(16, eq.width * zoom);
      const hPx = Math.max(16, eq.height * zoom);

      ctx.save();
      ctx.translate(sc.x, sc.y);
      ctx.rotate((eq.rotation * Math.PI) / 180);

      const blockColor = eq.color || '#0284c7';
      ctx.fillStyle = isSelected ? 'rgba(6, 182, 212, 0.35)' : 'rgba(2, 132, 199, 0.22)';
      ctx.strokeStyle = isSelected ? '#06b6d4' : blockColor;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;

      const category = eq.category || '';
      if (category === 'cooling_tower' || category === 'compressor') {
        const radius = Math.max(wPx, hPx) / 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);
        ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);
      }

      if (isSelected) {
        // Corner resize handles
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        [
          { x: -wPx / 2, y: -hPx / 2 },
          { x: wPx / 2, y: -hPx / 2 },
          { x: wPx / 2, y: hPx / 2 },
          { x: -wPx / 2, y: hPx / 2 }
        ].forEach(corner => {
          ctx.beginPath();
          ctx.arc(corner.x, corner.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }

      // Equipment Label
      ctx.fillStyle = isSelected ? '#ffffff' : '#e2e8f0';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(eq.name.substring(0, 16), 0, 0);

      ctx.restore();
    });

    // 5. Draw Active Drawing Previews
    if (drawingPoints.length > 0) {
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      // Segment preview
      ctx.beginPath();
      const firstS = worldToScreen(drawingPoints[0].x, drawingPoints[0].y);
      ctx.moveTo(firstS.x, firstS.y);

      for (let i = 1; i < drawingPoints.length; i++) {
        const ptS = worldToScreen(drawingPoints[i].x, drawingPoints[i].y);
        ctx.lineTo(ptS.x, ptS.y);
      }

      // Line to current cursor
      const curS = worldToScreen(cursorWorld.x, cursorWorld.y);
      ctx.lineTo(curS.x, curS.y);

      if (activeTool === 'room') {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
        ctx.fill();
      }
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Preview Live Segment Length & Area
      const lastPt = drawingPoints[drawingPoints.length - 1];
      const liveDist = calculateSegmentLength(lastPt, cursorWorld);

      ctx.fillStyle = '#e9d5ff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${liveDist.toFixed(2)} m`, (curS.x + worldToScreen(lastPt.x, lastPt.y).x) / 2, (curS.y + worldToScreen(lastPt.x, lastPt.y).y) / 2 - 8);
    }

    // 6. Draw Vertex Handles (Nodes) for Selected Tool / Selection
    if (activeTool === 'select' || activeTool === 'wall' || activeTool === 'room') {
      allNodes.forEach(node => {
        const sc = worldToScreen(node.x, node.y);
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    // 7. Draw Snapping Cursor Highlight
    const cursorScreen = worldToScreen(cursorWorld.x, cursorWorld.y);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cursorScreen.x, cursorScreen.y, 6, 0, Math.PI * 2);
    ctx.stroke();

    // 8. Render Compass / North Indicator Overlay
    ctx.save();
    const compassX = width - 40;
    const compassY = 40;
    ctx.translate(compassX, compassY);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -10);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.fillText('S', 0, 10);
    ctx.fillText('L', 10, 0);
    ctx.fillText('O', -10, 0);
    ctx.restore();

    return () => {
      ctx.clearRect(0, 0, width, height);
    };
  }, [rooms, walls, windows, equipments, drawingPoints, cursorWorld, panOffset, zoom, activeTool, gridOptions, selectedRoomId, selectedWallId, selectedWindowId, selectedEquipmentId, allNodes, worldToScreen]);

  // Calculate exact canvas pixel coordinates from MouseEvent using getBoundingClientRect() and CSS scaling factor
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement> | MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return getCanvasMousePosition(e.clientX, e.clientY, rect, canvas.width, canvas.height);
  }, []);

  // Handle Mouse Move: Cursor Snapping & Interactive Vertex/Element Dragging
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const mouseScreen = getCanvasCoords(e);

    if (isPanning) {
      setPanOffset({
        x: panOffset.x + (mouseScreen.x - panStart.x),
        y: panOffset.y + (mouseScreen.y - panStart.y)
      });
      setPanStart({ x: mouseScreen.x, y: mouseScreen.y });
      return;
    }

    const rawWorld = screenToWorld(mouseScreen.x, mouseScreen.y);
    const snapped = applySnapping(rawWorld, allNodes, gridOptions);
    setCursorWorld(snapped);

    // Interactive Dragging of individual Polygon Vertices, Wall Nodes, or Equipment Centers
    if (activeTool === 'select') {
      if (draggedTarget) {
        if (draggedTarget.type === 'room_vertex' && draggedTarget.vertexIndex !== undefined) {
          setRooms(prev => prev.map(r => r.id === draggedTarget.id ? {
            ...r,
            points: updatePolygonVertex(r.points, draggedTarget.vertexIndex!, snapped)
          } : r));
        } else if (draggedTarget.type === 'equipment_center') {
          setEquipments(prev => prev.map(eq => eq.id === draggedTarget.id ? updateEquipmentPosition(eq, snapped, rooms) : eq));
        }
      } else if (draggedNode) {
        const { updatedRooms, updatedWalls } = updateNodePosition(draggedNode, snapped, rooms, walls, 0.2);
        setRooms(updatedRooms);
        setWalls(updatedWalls);
        setDraggedNode(snapped);
      }
    }
  }, [getCanvasCoords, isPanning, panOffset, panStart, screenToWorld, allNodes, gridOptions, draggedTarget, draggedNode, activeTool, rooms, walls]);

  // Handle Mouse Down / Canvas Click: Drawing & Granular Selection
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const mouseScreen = getCanvasCoords(e);

    // Pan Mode or Middle Mouse Click
    if (activeTool === 'pan' || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: mouseScreen.x, y: mouseScreen.y });
      return;
    }

    const rawWorld = screenToWorld(mouseScreen.x, mouseScreen.y);
    const snapped = applySnapping(rawWorld, allNodes, gridOptions);

    // Tool 1: Select / Granular Selection & Node Dragging
    if (activeTool === 'select') {
      // 1. Check room vertex handles for polygon vertex dragging & interactive resizing
      for (const r of rooms) {
        for (let i = 0; i < r.points.length; i++) {
          const pt = r.points[i];
          if (Math.hypot(pt.x - rawWorld.x, pt.y - rawWorld.y) <= 0.45) {
            setSelectedRoomId(r.id);
            if (onSelectPolyId) onSelectPolyId(r.id);
            setSelectedWallId(null);
            setSelectedWindowId(null);
            setSelectedEquipmentId(null);
            setDraggedTarget({ type: 'room_vertex', id: r.id, vertexIndex: i });
            return;
          }
        }
      }

      // 2. Check wall nodes (p1, p2)
      for (const w of walls) {
        if (Math.hypot(w.p1.x - rawWorld.x, w.p1.y - rawWorld.y) <= 0.45) {
          setSelectedWallId(w.id);
          setSelectedRoomId(null);
          setSelectedWindowId(null);
          setSelectedEquipmentId(null);
          setDraggedNode({ ...w.p1 });
          return;
        }
        if (Math.hypot(w.p2.x - rawWorld.x, w.p2.y - rawWorld.y) <= 0.45) {
          setSelectedWallId(w.id);
          setSelectedRoomId(null);
          setSelectedWindowId(null);
          setSelectedEquipmentId(null);
          setDraggedNode({ ...w.p2 });
          return;
        }
      }

      // 3. Check ForgeCAD Equipment Blocks
      const clickedEq = equipments.find(eq => isPointInEquipmentBlock(rawWorld, eq, 0.2));
      if (clickedEq) {
        setSelectedEquipmentId(clickedEq.id);
        setSelectedRoomId(null);
        setSelectedWallId(null);
        setSelectedWindowId(null);
        if (onSelectPolyId) onSelectPolyId(null);
        setDraggedTarget({ type: 'equipment_center', id: clickedEq.id });
        return;
      }

      // 4. Check Windows
      const clickedWin = windows.find(w => isPointNearWindow(rawWorld, w.center, 0.6));
      if (clickedWin) {
        setSelectedWindowId(clickedWin.id);
        setSelectedRoomId(null);
        setSelectedWallId(null);
        setSelectedEquipmentId(null);
        if (onSelectPolyId) onSelectPolyId(null);
        return;
      }

      // 5. Check Walls
      const clickedWall = walls.find(w => isPointNearWall(rawWorld, w.p1, w.p2, 10, zoom));
      if (clickedWall) {
        setSelectedWallId(clickedWall.id);
        setSelectedRoomId(null);
        setSelectedWindowId(null);
        setSelectedEquipmentId(null);
        if (onSelectPolyId) onSelectPolyId(null);
        return;
      }

      // 6. Check Room Polygon Interior (Point-in-Polygon)
      const clickedRoom = rooms.find(r => isPointInPolygon(rawWorld, r.points));
      if (clickedRoom) {
        setSelectedRoomId(clickedRoom.id);
        if (onSelectPolyId) onSelectPolyId(clickedRoom.id);
        setSelectedWallId(null);
        setSelectedWindowId(null);
        setSelectedEquipmentId(null);
        return;
      }

      // 7. Clicked empty space: clear all selections
      setSelectedRoomId(null);
      setSelectedWallId(null);
      setSelectedWindowId(null);
      setSelectedEquipmentId(null);
      if (onSelectPolyId) onSelectPolyId(null);
    }

    // Tool 2: Wall Tool
    if (activeTool === 'wall') {
      if (drawingPoints.length === 0) {
        setDrawingPoints([snapped]);
      } else {
        const p1 = drawingPoints[drawingPoints.length - 1];
        const p2 = snapped;

        if (calculateSegmentLength(p1, p2) >= 0.2) {
          const newWall: VectorWall = {
            id: `wall-${Date.now()}`,
            p1,
            p2,
            type: 'alvenaria_leve',
            height: 2.8
          };
          setWalls(prev => [...prev, newWall]);
          setSelectedWallId(newWall.id);
          setSelectedRoomId(null);
          setSelectedWindowId(null);
          setSelectedEquipmentId(null);
          showNotify(`Parede de ${calculateSegmentLength(p1, p2).toFixed(2)}m criada!`, 'success');
        }
        setDrawingPoints([]);
      }
      return;
    }

    // Tool 3: Room Polygon Tool
    if (activeTool === 'room') {
      if (drawingPoints.length === 0) {
        setDrawingPoints([snapped]);
      } else {
        const firstPt = drawingPoints[0];
        // If clicked near first vertex, close polygon
        if (drawingPoints.length >= 3 && Math.hypot(snapped.x - firstPt.x, snapped.y - firstPt.y) <= 0.5) {
          const newRoom: VectorRoom = {
            id: `room-${Date.now()}`,
            name: `Recinto ${rooms.length + 1}`,
            points: drawingPoints,
            height: 2.8,
            activity: 'comercial_baixo',
            zonaId: 3,
            hasRoof: true,
            roofType: 'laje_simples',
            lightingWatts: Math.round(calculatePolygonArea(drawingPoints) * 15)
          };
          setRooms(prev => [...prev, newRoom]);
          setSelectedRoomId(newRoom.id);
          setSelectedWallId(null);
          setSelectedWindowId(null);
          setSelectedEquipmentId(null);
          if (onSelectPolyId) onSelectPolyId(newRoom.id);
          setDrawingPoints([]);
          showNotify(`Recinto "${newRoom.name}" (${calculatePolygonArea(drawingPoints).toFixed(2)} m²) criado!`, 'success');
        } else {
          setDrawingPoints(prev => [...prev, snapped]);
        }
      }
      return;
    }

    // Tool 4: Window Tool
    if (activeTool === 'window') {
      const orient = getSegmentOrientation({ x: snapped.x, y: snapped.y }, { x: snapped.x + 1, y: snapped.y });
      const newWin: VectorWindow = {
        id: `win-${Date.now()}`,
        center: snapped,
        length: 2.0,
        height: 1.5,
        area: 3.0,
        glassType: 'simples',
        protection: 0.7,
        orientation: orient
      };
      setWindows(prev => [...prev, newWin]);
      setSelectedWindowId(newWin.id);
      setSelectedRoomId(null);
      setSelectedWallId(null);
      setSelectedEquipmentId(null);
      showNotify(`Janela (${orient}) posicionada!`, 'success');
    }

    // Tool 5: ForgeCAD Equipment Tool
    if (activeTool === 'equipment') {
      const blkDef = getHvacBlockById(selectedBlockTemplate) || HVAC_BLOCK_LIBRARY[0];
      const newEq: VectorForgeBlock = {
        id: `forge-eq-${Date.now()}`,
        blockId: blkDef.id,
        name: blkDef.name,
        category: blkDef.category,
        center: snapped,
        width: blkDef.dimensions.length,
        height: blkDef.dimensions.width,
        rotation: 0,
        electricPowerWatts: blkDef.electricPowerWatts,
        thermalCapacityBTU: blkDef.thermalCapacityBTU,
        color: blkDef.symbol2D.color
      };
      setEquipments(prev => [...prev, newEq]);
      setSelectedEquipmentId(newEq.id);
      setSelectedRoomId(null);
      setSelectedWallId(null);
      setSelectedWindowId(null);
      showNotify(`Bloco ForgeCAD "${blkDef.symbol2D.label}" posicionado!`, 'success');
    }
  }, [getCanvasCoords, activeTool, selectedBlockTemplate, screenToWorld, allNodes, gridOptions, rooms, walls, windows, equipments, drawingPoints, onSelectPolyId, showNotify]);

  // Handle Mouse Up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggedNode(null);
    setDraggedTarget(null);
  }, []);

  // Native Non-Passive Wheel Event Listener for Zoom-to-Mouse with e.preventDefault()
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseScreen = getCanvasMousePosition(e.clientX, e.clientY, rect, canvas.width, canvas.height);
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;

      const nextZoom = Math.max(10, Math.min(120, zoom * zoomFactor));
      const nextPan = calculateZoomPanToMouse(mouseScreen, panOffset, zoom, nextZoom);
      
      setZoom(nextZoom);
      setPanOffset(nextPan);
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleNativeWheel);
    };
  }, [zoom, panOffset]);

  // Zoom to Center button handler for UI Toolbar buttons
  const handleZoomButton = useCallback((factor: number) => {
    const canvas = canvasRef.current;
    const centerScreen = canvas ? { x: canvas.width / 2, y: canvas.height / 2 } : { x: 450, y: 300 };
    setZoom(prevZoom => {
      const nextZoom = Math.max(10, Math.min(120, prevZoom * factor));
      setPanOffset(prevPan => calculateZoomPanToMouse(centerScreen, prevPan, prevZoom, nextZoom));
      return nextZoom;
    });
  }, []);

  // Double Click / Enter Key: Finish Room Polygon Drawing
  const finishDrawing = useCallback(() => {
    if (activeTool === 'room' && drawingPoints.length >= 3) {
      const newRoom: VectorRoom = {
        id: `room-${Date.now()}`,
        name: `Recinto ${rooms.length + 1}`,
        points: drawingPoints,
        height: 2.8,
        activity: 'comercial_baixo',
        zonaId: 3,
        hasRoof: true,
        roofType: 'laje_simples',
        lightingWatts: Math.round(calculatePolygonArea(drawingPoints) * 15)
      };
      setRooms(prev => [...prev, newRoom]);
      setSelectedRoomId(newRoom.id);
      if (onSelectPolyId) onSelectPolyId(newRoom.id);
      setDrawingPoints([]);
      showNotify(`Recinto "${newRoom.name}" criado!`, 'success');
    } else {
      setDrawingPoints([]);
    }
  }, [activeTool, drawingPoints, rooms.length, onSelectPolyId, showNotify]);

  // Granular Delete Selected Element (Room, Wall, Window, or Equipment Block)
  const handleDeleteSelected = useCallback(() => {
    if (selectedEquipmentId) {
      const eq = equipments.find(e => e.id === selectedEquipmentId);
      setEquipments(prev => prev.filter(e => e.id !== selectedEquipmentId));
      setSelectedEquipmentId(null);
      showNotify(`Equipamento "${eq?.name || 'ForgeCAD'}" removido.`, 'info');
    } else if (selectedRoomId) {
      const r = rooms.find(r => r.id === selectedRoomId);
      setRooms(prev => prev.filter(room => room.id !== selectedRoomId));
      setSelectedRoomId(null);
      if (onSelectPolyId) onSelectPolyId(null);
      showNotify(`Recinto "${r?.name || ''}" removido.`, 'info');
    } else if (selectedWallId) {
      setWalls(prev => prev.filter(w => w.id !== selectedWallId));
      setSelectedWallId(null);
      showNotify('Parede removida.', 'info');
    } else if (selectedWindowId) {
      setWindows(prev => prev.filter(w => w.id !== selectedWindowId));
      setSelectedWindowId(null);
      showNotify('Janela removida.', 'info');
    }
  }, [selectedEquipmentId, selectedRoomId, selectedWallId, selectedWindowId, equipments, rooms, onSelectPolyId, showNotify]);

  // Keyboard Delete / Backspace Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeTag = (document.activeElement?.tagName || '').toUpperCase();
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
          return;
        }
        if (selectedRoomId || selectedWallId || selectedWindowId || selectedEquipmentId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedRoomId, selectedWallId, selectedWindowId, selectedEquipmentId, handleDeleteSelected]);

  // Reset Canvas Viewport
  const resetView = useCallback(() => {
    setZoom(30);
    setPanOffset({ x: 150, y: 150 });
  }, []);

  // Convert Vector Geometry and Export to ThermalLoadCalculator
  const handleExportToHVAC = useCallback((mode: 'append' | 'replace') => {
    const exportedEnvs = convertVectorCanvasToHVACEnvironments(rooms, walls, windows, 2.8, equipments);
    if (exportedEnvs.length === 0) {
      showNotify('Desenhe ao menos um recinto ou parede antes de exportar.', 'info');
      return;
    }
    if (onExportEnvironments) {
      onExportEnvironments(exportedEnvs, mode);
    }
    showNotify(`${exportedEnvs.length} ambiente(s) exportado(s) para o cálculo HVAC com sucesso!`, 'success');
  }, [rooms, walls, windows, equipments, showNotify, onExportEnvironments]);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const selectedWall = walls.find(w => w.id === selectedWallId);
  const selectedWindow = windows.find(w => w.id === selectedWindowId);
  const selectedEquipment = equipments.find(e => e.id === selectedEquipmentId);

  const selectedRoomThermalLoad = useMemo(() => {
    if (!selectedRoom) return null;
    return calculateRoomThermalLoad(selectedRoom, walls, windows, materialsCatalog, equipments);
  }, [selectedRoom, walls, windows, materialsCatalog, equipments]);

  const totalCanvasThermalLoad = useMemo(() => {
    return rooms.reduce((acc, r) => acc + calculateRoomThermalLoad(r, walls, windows, materialsCatalog, equipments).total, 0);
  }, [rooms, walls, windows, materialsCatalog, equipments]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-0 text-slate-100 flex flex-col xl:flex-row min-h-[640px]">

      {/* PAINEL LATERAL ESQUERDO: INSPETOR DE SELEÇÃO 2D & FERRAMENTAS */}
      <div className="w-full xl:w-80 bg-slate-950/90 border-r border-slate-800 p-5 space-y-5 flex flex-col justify-between shrink-0 font-sans">
        <div className="space-y-4">
          
          {/* Header Inspetor de Seleção 2D */}
          <div className="border-b border-slate-800 pb-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h3 className="font-extrabold text-white text-xs uppercase tracking-wider">Inspetor de Seleção 2D</h3>
              </div>
              <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/60 font-bold">
                PASCAL 2D
              </span>
            </div>
            
            {/* Badges de Status Corporativo */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 rounded flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                PARAMETRIC CAD: SYNCED
              </span>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-slate-950 text-cyan-400 border border-cyan-800/80 rounded flex items-center gap-1 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                STRIX AUDIT
              </span>
            </div>
          </div>

          {/* Selector de Ferramentas Interativas */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Ferramentas de Desenho</label>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <button
                onClick={() => { setActiveTool('select'); setDrawingPoints([]); }}
                className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                  activeTool === 'select'
                    ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <MousePointer className="w-4 h-4 text-cyan-300" /> Selecionar / Nós
              </button>

              <button
                onClick={() => { setActiveTool('room'); setDrawingPoints([]); }}
                className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                  activeTool === 'room'
                    ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Square className="w-4 h-4 text-cyan-300" /> Desenhar Recinto
              </button>

              <button
                onClick={() => { setActiveTool('wall'); setDrawingPoints([]); }}
                className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                  activeTool === 'wall'
                    ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Pencil className="w-4 h-4 text-cyan-300" /> Criar Parede
              </button>

              <button
                onClick={() => { setActiveTool('window'); setDrawingPoints([]); }}
                className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                  activeTool === 'window'
                    ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Maximize2 className="w-4 h-4 text-amber-400" /> Inserir Janela
              </button>

              <button
                onClick={() => { setActiveTool('equipment'); setDrawingPoints([]); }}
                className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all col-span-2 ${
                  activeTool === 'equipment'
                    ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Box className="w-4 h-4 text-cyan-400" /> Bloco ForgeCAD (HVAC)
              </button>
            </div>

            {/* Template Selector Dropdown when equipment tool is active */}
            {activeTool === 'equipment' && (
              <div className="pt-1">
                <label className="text-[10px] text-slate-400 block mb-1">Modelo de Equipamento ForgeCAD</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-medium text-xs"
                  value={selectedBlockTemplate}
                  onChange={e => setSelectedBlockTemplate(e.target.value)}
                >
                  {HVAC_BLOCK_LIBRARY.map(blk => (
                    <option key={blk.id} value={blk.id}>
                      {blk.symbol2D.label} - {blk.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Opções de Snapping e Grade */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Grid className="w-3.5 h-3.5 text-cyan-400" /> Atração / Snapping
              </span>
              <input
                type="checkbox"
                className="w-4 h-4 text-cyan-600 rounded bg-slate-950 border-slate-800 cursor-pointer"
                checked={gridOptions.enabled}
                onChange={e => setGridOptions({ ...gridOptions, enabled: e.target.checked })}
              />
            </div>

            {gridOptions.enabled && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Passo da Grade</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-mono"
                    value={gridOptions.gridSize}
                    onChange={e => setGridOptions({ ...gridOptions, gridSize: parseFloat(e.target.value) })}
                  >
                    <option value={0.25}>0.25 m</option>
                    <option value={0.5}>0.50 m</option>
                    <option value={1.0}>1.00 m</option>
                    <option value={2.0}>2.00 m</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="text-[10px] text-slate-400 mb-1 flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 text-cyan-600 rounded bg-slate-950"
                      checked={gridOptions.snapToNodes}
                      onChange={e => setGridOptions({ ...gridOptions, snapToNodes: e.target.checked })}
                    />
                    Snap a Nós
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* PAINEL INSPETOR DE SELEÇÃO 2D: RECINTO */}
          {selectedRoom && (
            <div className="bg-slate-900/90 p-4 rounded-xl border border-cyan-500/40 space-y-3.5 text-xs shadow-lg backdrop-blur-md">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h4 className="font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" /> Inspetor: Recinto
                </h4>
                <button onClick={handleDeleteSelected} className="text-rose-400 hover:text-rose-300 p-1" title="Excluir Recinto (Delete)">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Nome do Recinto</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-semibold focus:border-cyan-500"
                  value={selectedRoom.name}
                  onChange={e => {
                    const name = e.target.value;
                    setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, name } : r));
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Área Calculada</span>
                  <span className="font-bold text-cyan-400 text-sm">{calculatePolygonArea(selectedRoom.points).toFixed(2)} m²</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Pé-Direito (m)</span>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full bg-transparent text-white font-bold"
                    value={selectedRoom.height}
                    onChange={e => {
                      const height = parseFloat(e.target.value);
                      setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, height } : r));
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Atividade Operacional</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white"
                  value={selectedRoom.activity}
                  onChange={e => {
                    const activity = e.target.value as ActivityType;
                    setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, activity } : r));
                  }}
                >
                  <option value="residencial">Residencial / Repouso</option>
                  <option value="comercial_baixo">Escritório / Administrativo</option>
                  <option value="comercial_alto">Loja / Shopping / Comércio</option>
                  <option value="cozinha">Cozinha / Gourmet</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Zona Bioclimática NBR 15220</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-semibold"
                  value={selectedRoom.zonaId}
                  onChange={e => {
                    const zonaId = parseInt(e.target.value);
                    setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, zonaId } : r));
                  }}
                >
                  {EXTENDED_ZONAS_BIOCLIMATICAS.map(z => (
                    <option key={z.id} value={z.id}>{z.nome}</option>
                  ))}
                </select>
              </div>

              {/* Seleção de Materiais por Camada */}
              <div className="space-y-2 border-t border-slate-800 pt-2">
                <label className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">Materiais Construtivos (Camadas)</label>
                
                <div>
                  <label className="text-slate-400 block mb-1">Material das Paredes</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-medium text-xs"
                    value={selectedRoom.wallType || 'alvenaria_leve'}
                    onChange={e => {
                      const wallType = e.target.value as WallType;
                      setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, wallType } : r));
                    }}
                  >
                    {materialsCatalog.paredes.map(m => (
                      <option key={m.id} value={m.id}>{m.name} (U={m.uFactor})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Material do Telhado / Cobertura</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-medium text-xs"
                    value={selectedRoom.roofType || 'laje_simples'}
                    onChange={e => {
                      const roofType = e.target.value as RoofType;
                      setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, roofType } : r));
                    }}
                  >
                    {materialsCatalog.telhados.map(m => (
                      <option key={m.id} value={m.id}>{m.name} (U={m.uFactor})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Tipo de Vidro (Janelas)</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-medium text-xs"
                    value={selectedRoom.glassType || 'simples'}
                    onChange={e => {
                      const glassType = e.target.value as GlassType;
                      setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, glassType } : r));
                    }}
                  >
                    {materialsCatalog.vidros.map(m => (
                      <option key={m.id} value={m.id}>{m.name} (U={m.uFactor})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ocupantes e Cargas Elétricas */}
              <div className="space-y-2 border-t border-slate-800 pt-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Cargas Internas</label>
                <div className="grid grid-cols-3 gap-1.5 font-mono">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Pessoas</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-bold"
                      value={selectedRoom.occupants !== undefined ? selectedRoom.occupants : Math.max(1, Math.round(calculatePolygonArea(selectedRoom.points) / 8))}
                      onChange={e => {
                        const occupants = parseInt(e.target.value) || 0;
                        setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, occupants } : r));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Ilum. (W)</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-bold"
                      value={selectedRoom.lightingWatts}
                      onChange={e => {
                        const lightingWatts = parseInt(e.target.value) || 0;
                        setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, lightingWatts } : r));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Equip. (W)</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-bold"
                      value={selectedRoom.equipmentWatts || 0}
                      onChange={e => {
                        const equipmentWatts = parseInt(e.target.value) || 0;
                        setRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, equipmentWatts } : r));
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Real-Time Thermal Load Breakdown Card */}
              {selectedRoomThermalLoad && (
                <div className="bg-amber-950/40 border border-amber-500/40 p-3 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> Carga Térmica em Tempo Real
                    </span>
                    <span className="text-[9px] bg-amber-900/60 text-amber-300 font-mono px-1.5 py-0.5 rounded border border-amber-700/50">
                      LIVE
                    </span>
                  </div>
                  
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-base font-extrabold text-amber-300">
                      {selectedRoomThermalLoad.total.toLocaleString('pt-BR')} <span className="text-xs">BTU/h</span>
                    </span>
                    <span className="text-xs font-bold text-cyan-400">
                      {(selectedRoomThermalLoad.total * 0.000293071).toFixed(2)} kW
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-300 border-t border-amber-800/40 pt-1.5 flex justify-between">
                    <span className="text-slate-400">Sugerido:</span>
                    <span className="font-bold text-emerald-400">{selectedRoomThermalLoad.sugerida}</span>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* PAINEL INSPETOR DE SELEÇÃO 2D: PAREDE */}
          {selectedWall && (
            <div className="bg-slate-900/90 p-4 rounded-xl border border-purple-800/60 space-y-3 text-xs shadow-lg backdrop-blur-md">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h4 className="font-extrabold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Inspetor: Parede
                </h4>
                <button onClick={handleDeleteSelected} className="text-rose-400 hover:text-rose-300 p-1" title="Excluir Parede (Delete)">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Material Construtivo (Parede)</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-medium"
                  value={selectedWall.type || 'alvenaria_leve'}
                  onChange={e => {
                    const type = e.target.value as WallType;
                    setWalls(prev => prev.map(w => w.id === selectedWall.id ? { ...w, type } : w));
                  }}
                >
                  {materialsCatalog.paredes.map(m => (
                    <option key={m.id} value={m.id}>{m.name} (U={m.uFactor})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>
                  <label className="text-slate-400 block mb-1">Comprimento (m)</label>
                  <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-cyan-400 font-bold">
                    {calculateSegmentLength(selectedWall.p1, selectedWall.p2).toFixed(2)} m
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Altura (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-mono font-bold"
                    value={selectedWall.height}
                    onChange={e => {
                      const height = parseFloat(e.target.value);
                      setWalls(prev => prev.map(w => w.id === selectedWall.id ? { ...w, height } : w));
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* PAINEL INSPETOR DE SELEÇÃO 2D: JANELA */}
          {selectedWindow && (
            <div className="bg-slate-900/90 p-4 rounded-xl border border-amber-800/60 space-y-3 text-xs shadow-lg backdrop-blur-md">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h4 className="font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" /> Inspetor: Janela
                </h4>
                <button onClick={handleDeleteSelected} className="text-rose-400 hover:text-rose-300 p-1" title="Excluir Janela (Delete)">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Comprimento (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-mono"
                    value={selectedWindow.length}
                    onChange={e => {
                      const length = parseFloat(e.target.value) || 0;
                      setWindows(prev => prev.map(w => w.id === selectedWindow.id ? { ...w, length, area: length * (w.height || 1.5) } : w));
                    }}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Altura (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-mono"
                    value={selectedWindow.height}
                    onChange={e => {
                      const height = parseFloat(e.target.value) || 0;
                      setWindows(prev => prev.map(w => w.id === selectedWindow.id ? { ...w, height, area: (w.length || 2.0) * height } : w));
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Tipo de Vidro</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-medium"
                  value={selectedWindow.glassType || 'simples'}
                  onChange={e => {
                    const glassType = e.target.value as GlassType;
                    setWindows(prev => prev.map(w => w.id === selectedWindow.id ? { ...w, glassType } : w));
                  }}
                >
                  {materialsCatalog.vidros.map(m => (
                    <option key={m.id} value={m.id}>{m.name} (U={m.uFactor})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Orientação Solar</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white uppercase font-bold"
                  value={selectedWindow.orientation}
                  onChange={e => {
                    const orientation = e.target.value as Orientation;
                    setWindows(prev => prev.map(w => w.id === selectedWindow.id ? { ...w, orientation } : w));
                  }}
                >
                  <option value="norte">Norte</option>
                  <option value="sul">Sul</option>
                  <option value="leste">Leste</option>
                  <option value="oeste">Oeste</option>
                </select>
              </div>
            </div>
          )}

          {/* PAINEL INSPETOR DE SELEÇÃO 2D: EQUIPAMENTO FORGECAD */}
          {selectedEquipment && (
            <div className="bg-slate-900/90 p-4 rounded-xl border border-blue-800/60 space-y-3 text-xs shadow-lg backdrop-blur-md">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h4 className="font-extrabold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-blue-400" /> Inspetor: Equipamento ForgeCAD
                </h4>
                <button onClick={handleDeleteSelected} className="text-rose-400 hover:text-rose-300 p-1" title="Excluir Equipamento (Delete)">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Nome do Equipamento</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-semibold focus:border-blue-500"
                  value={selectedEquipment.name}
                  onChange={e => {
                    const name = e.target.value;
                    setEquipments(prev => prev.map(eq => eq.id === selectedEquipment.id ? { ...eq, name } : eq));
                  }}
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Modelo no Catálogo ForgeCAD</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-medium"
                  value={selectedEquipment.blockId}
                  onChange={e => {
                    const blkId = e.target.value;
                    const blkDef = getHvacBlockById(blkId);
                    if (blkDef) {
                      setEquipments(prev => prev.map(eq => eq.id === selectedEquipment.id ? {
                        ...eq,
                        blockId: blkDef.id,
                        name: blkDef.name,
                        category: blkDef.category,
                        width: blkDef.dimensions.length,
                        height: blkDef.dimensions.width,
                        electricPowerWatts: blkDef.electricPowerWatts,
                        thermalCapacityBTU: blkDef.thermalCapacityBTU,
                        color: blkDef.symbol2D.color
                      } : eq));
                    }
                  }}
                >
                  {HVAC_BLOCK_LIBRARY.map(blk => (
                    <option key={blk.id} value={blk.id}>{blk.symbol2D.label} - {blk.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>
                  <label className="text-slate-400 block mb-1">Largura (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-bold"
                    value={selectedEquipment.width}
                    onChange={e => {
                      const w = parseFloat(e.target.value) || 0.2;
                      setEquipments(prev => prev.map(eq => eq.id === selectedEquipment.id ? updateEquipmentDimensions(eq, w, eq.height) : eq));
                    }}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Profundidade (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-bold"
                    value={selectedEquipment.height}
                    onChange={e => {
                      const h = parseFloat(e.target.value) || 0.2;
                      setEquipments(prev => prev.map(eq => eq.id === selectedEquipment.id ? updateEquipmentDimensions(eq, eq.width, h) : eq));
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>
                  <label className="text-slate-400 block mb-1">Potência (W)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-amber-400 font-bold"
                    value={selectedEquipment.electricPowerWatts}
                    onChange={e => {
                      const watts = parseInt(e.target.value) || 0;
                      setEquipments(prev => prev.map(eq => eq.id === selectedEquipment.id ? { ...eq, electricPowerWatts: watts } : eq));
                    }}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Capacidade (BTU/h)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-cyan-400 font-bold"
                    value={selectedEquipment.thermalCapacityBTU}
                    onChange={e => {
                      const btu = parseInt(e.target.value) || 0;
                      setEquipments(prev => prev.map(eq => eq.id === selectedEquipment.id ? { ...eq, thermalCapacityBTU: btu } : eq));
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Rotação (Graus)</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-mono"
                  value={selectedEquipment.rotation}
                  onChange={e => {
                    const rot = parseInt(e.target.value) || 0;
                    setEquipments(prev => prev.map(eq => eq.id === selectedEquipment.id ? { ...eq, rotation: rot } : eq));
                  }}
                >
                  <option value={0}>0° (Horizontal)</option>
                  <option value={90}>90° (Vertical)</option>
                  <option value={180}>180° (Invertido)</option>
                  <option value={270}>270° (Vertical Op.)</option>
                </select>
              </div>
            </div>
          )}

          {/* INSPETOR ESTADO ZERO / SELEÇÃO GLOBAL */}
          {!selectedRoom && !selectedWall && !selectedWindow && !selectedEquipment && (
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/90 space-y-3 text-xs backdrop-blur-sm">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h4 className="font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" /> Inspetor: Visão Geral 2D
                </h4>
                <span className="text-[9px] bg-slate-800 text-cyan-300 font-mono px-1.5 py-0.5 rounded border border-slate-700">
                  READY
                </span>
              </div>

              <div className="space-y-2 text-slate-400 leading-relaxed text-[11px]">
                <p>Nenhum elemento selecionado no momento.</p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 font-mono text-[10px]">
                  <div className="flex justify-between text-slate-300">
                    <span>Vértices Totais:</span>
                    <span className="text-cyan-400 font-bold">{allNodes.length} nós</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Recintos no Layout:</span>
                    <span className="text-cyan-400 font-bold">{rooms.length}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Equipamentos ForgeCAD:</span>
                    <span className="text-cyan-400 font-bold">{equipments.length}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Snapping Ativo:</span>
                    <span className="text-emerald-400 font-bold">{gridOptions.enabled ? `${gridOptions.gridSize}m` : 'OFF'}</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 italic pt-1">
                  💡 Clique em qualquer recinto, parede, janela ou equipamento no canvas 2D para ajustar seus parâmetros em tempo real.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Resumo do Projeto Vetorial & Botão Exportar */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">Recintos: <strong>{rooms.length}</strong> ({totalFloorArea.toFixed(1)} m²)</span>
            <span className="text-amber-400 font-bold">⚡ {totalCanvasThermalLoad.toLocaleString('pt-BR')} BTU/h ({(totalCanvasThermalLoad * 0.000293071).toFixed(1)} kW)</span>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => handleExportToHVAC('replace')}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 border border-cyan-400/40"
            >
              <Check className="w-4 h-4" /> Converter & Aplicar no Projeto
            </button>
            <button
              onClick={() => handleExportToHVAC('append')}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" /> Adicionar aos Ambientes Existentes
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA CENTRAL: CANVAS 2D E CONTROLES DE NAVEGAÇÃO */}
      <div className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden min-h-[500px]">
        
        {/* BARRA SUPERIOR DE CONTROLES E STATUS DA FERRAMENTA */}
        <div className="bg-slate-900/90 border-b border-slate-800 p-3 px-4 flex justify-between items-center flex-wrap gap-3 z-10 backdrop-blur-md">
          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            <span className="text-slate-400 font-medium">Modo Ativo:</span>
            <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800/80 rounded-lg font-mono font-bold uppercase flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> {activeTool.toUpperCase()}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 rounded-md flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
              <MousePointer className="w-3.5 h-3.5 text-cyan-400" /> ZOOM-TO-MOUSE: ACTIVE
            </span>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 rounded-md flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> PARAMETRIC CAD: SYNCED
            </span>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-950 text-cyan-400 border border-cyan-800/80 rounded-md flex items-center gap-1 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> STRIX AUDIT BADGE
            </span>
            {drawingPoints.length > 0 && (
              <span className="text-amber-400 font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60 animate-pulse">
                Desenhando: {drawingPoints.length} vértices (Pressione Concluir ou duplo clique)
              </span>
            )}
          </div>

          {/* Controles de Zoom, Exclusão e Viewport */}
          <div className="flex items-center gap-2 text-xs">
            {drawingPoints.length > 0 && (
              <button
                onClick={finishDrawing}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all"
              >
                <Check className="w-3.5 h-3.5" /> Concluir Polígono
              </button>
            )}
            {(selectedRoomId || selectedWallId || selectedWindowId || selectedEquipmentId) && (
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all"
                title="Excluir Elemento Selecionado (Delete / Backspace)"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir Seleção (Del)
              </button>
            )}
            <button
              onClick={() => handleZoomButton(1.2)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4 text-cyan-400" />
            </button>
            <span className="font-mono text-slate-400 text-xs px-1">{zoom.toFixed(0)} px/m</span>
            <button
              onClick={() => handleZoomButton(0.8)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4 text-cyan-400" />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700"
              title="Centralizar Visualização"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* NOTIFICAÇÃO POPUP NO CANVAS */}
        {notification && (
          <div className={`absolute top-16 left-6 z-20 px-4 py-2 rounded-xl text-xs font-bold border shadow-xl flex items-center gap-2 animate-in fade-in ${
            notification.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' : 'bg-slate-900/90 border-cyan-500/50 text-cyan-200'
          }`}>
            <Info className="w-4 h-4 text-cyan-400" /> {notification.message}
          </div>
        )}

        {/* ELEMENTO CANVAS HTML5 2D */}
        <div className="flex-1 w-full h-full relative cursor-crosshair">
          <canvas
            ref={canvasRef}
            width={1100}
            height={600}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            className="w-full h-full block bg-slate-950"
          />
        </div>
      </div>

    </div>
  );
});

HvacVectorCanvasEditor.displayName = 'HvacVectorCanvasEditor';

export default HvacVectorCanvasEditor;
