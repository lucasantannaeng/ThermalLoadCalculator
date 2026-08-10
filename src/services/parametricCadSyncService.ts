import { 
  HVACEnvironment, 
  HVACResult24h, 
  StandardMode, 
  Wall, 
  Window, 
  Equipment,
  Orientation, 
  WallType, 
  GlassType, 
  RoofType, 
  ActivityType,
  MaterialCatalog
} from '../types/hvac';
import { ParsedGeometry } from '../types/cad';
import { 
  VectorPoint, 
  VectorWall, 
  VectorWindow, 
  VectorRoom, 
  calculatePolygonArea,
  convertVectorCanvasToHVACEnvironments,
  getSegmentOrientation
} from './vectorEditorService';
import { calculateHVAC24h } from '../calculation/engines/hvacEngineFactory';
import { extractWallSegments } from './cadImporterService';

/**
 * Origem do evento de atualização paramétrica.
 */
export type SyncSource = 'canvas2d' | 'scene3d' | 'simulation' | 'engine' | 'system';

/**
 * Evento emitido quando o modelo paramétrico é alterado.
 */
export interface ParametricSyncEvent {
  type: '2d_updated' | '3d_updated' | 'simulation_updated' | 'mode_changed' | 'full_sync' | 'project_loaded';
  source: SyncSource;
  timestamp: number;
  version: number;
  environmentIds: string[];
  metadata?: Record<string, any>;
}

/**
 * Estado Paramétrico Consolidado (FreeCAD / ForgeCAD standard).
 */
export interface ParametricState {
  version: number;
  standardMode: StandardMode;
  environments: HVACEnvironment[];
  rooms: VectorRoom[];
  walls: VectorWall[];
  windows: VectorWindow[];
  geometries3D: Record<string, ParsedGeometry>;
  simulations24h: Record<string, HVACResult24h>;
  lastUpdatedSource: SyncSource;
}

export type ParametricListener = (state: ParametricState, event: ParametricSyncEvent) => void;

/**
 * Serviço de Sincronização Paramétrica Bidirecional em Tempo Real (FreeCAD / ForgeCAD Standard)
 * 
 * Mantém o modelo único da verdade (Single Source of Truth) para:
 * 1. Geometria Vetorial 2D (Salas, Paredes, Janelas, Esquadrias, Vértices)
 * 2. Visualização WebGL 3D (ParsedGeometry, HvacCadViewer)
 * 3. Simulação Dinâmica de Carga Térmica 24h (ABNT NBR 16401, ASHRAE RTS/CTF, ISO 52016-1)
 */
export class ParametricCadSyncService {
  private state: ParametricState;
  private listeners: Set<ParametricListener> = new Set();
  private isUpdating: boolean = false; // Trava contra ciclos infinitos de re-entrância
  private updateDepth: number = 0; // Guard de profundidade de transação

  constructor(initialMode: StandardMode = 'ABNT') {
    this.state = {
      version: 1,
      standardMode: initialMode,
      environments: [],
      rooms: [],
      walls: [],
      windows: [],
      geometries3D: {},
      simulations24h: {},
      lastUpdatedSource: 'system'
    };
  }

  /**
   * Executa uma ação de sincronização com trava estrita de re-entrância (FreeCAD Transaction Guard).
   * Impede recursão infinita e loops entre os componentes 2D Canvas, 3D WebGL e Simulação 24h.
   */
  private executeTransaction(
    source: SyncSource,
    type: ParametricSyncEvent['type'],
    environmentIds: string[],
    action: () => void,
    metadata?: Record<string, any>
  ): boolean {
    if (this.isUpdating || this.updateDepth > 0) {
      return false;
    }

    this.isUpdating = true;
    this.updateDepth++;

    let event: ParametricSyncEvent | null = null;
    try {
      action();
      this.state.version++;
      this.state.lastUpdatedSource = source;

      event = {
        type,
        source,
        timestamp: Date.now(),
        version: this.state.version,
        environmentIds,
        metadata
      };
    } finally {
      this.updateDepth--;
      this.isUpdating = false;
    }

    // Notificar APÓS liberar os guards de re-entrância (Fix C3)
    // Isso permite que listeners disparem cascatas sem serem silenciosamente rejeitados
    if (event) {
      this.notifyListeners(event);
    }

    return true;
  }

  /**
   * Registra um ouvinte para alterações paramétricas em tempo real.
   */
  public subscribe(listener: ParametricListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifica todos os ouvintes sobre uma mudança no modelo.
   * IMPORTANTE: Os subscribers DEVEM checar `if (event.source === mySource) return;`
   * para prevenir loops de echo (echo-back loops).
   */
  private notifyListeners(event: ParametricSyncEvent): void {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState, event);
      } catch (err) {
        console.error('[ParametricCadSyncService] Listener error:', err);
      }
    });
  }

  /**
   * Retorna uma cópia imutável do estado paramétrico atual.
   */
  public getState(): ParametricState {
    return {
      ...this.state,
      environments: [...this.state.environments.map(e => ({ ...e, walls: e.walls.map(w => ({...w})), windows: e.windows.map(w => ({...w})), equipment: e.equipment.map(eq => ({...eq})) }))],
      rooms: [...this.state.rooms.map(r => ({ ...r, points: r.points.map(p => ({ ...p })) }))],
      walls: [...this.state.walls.map(w => ({ ...w, p1: { ...w.p1 }, p2: { ...w.p2 } }))],
      windows: [...this.state.windows.map(w => ({ ...w, center: { ...w.center } }))],
      geometries3D: { ...this.state.geometries3D },
      simulations24h: { ...this.state.simulations24h }
    };
  }

  /**
   * Obtém um ambiente por ID.
   */
  public getEnvironment(envId: string): HVACEnvironment | undefined {
    return this.state.environments.find(e => e.id === envId);
  }

  /**
   * Obtém a geometria 3D por ID de ambiente.
   */
  public get3DGeometry(envId: string): ParsedGeometry | undefined {
    return this.state.geometries3D[envId];
  }

  /**
   * Obtém a simulação 24h por ID de ambiente.
   */
  public get24hSimulation(envId: string): HVACResult24h | undefined {
    return this.state.simulations24h[envId];
  }

  /**
   * Reseta o estado do serviço (útil para testes unitários ou reinicialização de projetos).
   */
  public reset(mode: StandardMode = 'ABNT'): void {
    this.isUpdating = false;
    this.updateDepth = 0;
    this.state = {
      version: 1,
      standardMode: mode,
      environments: [],
      rooms: [],
      walls: [],
      windows: [],
      geometries3D: {},
      simulations24h: {},
      lastUpdatedSource: 'system'
    };
    this.notifyListeners({ type: 'project_loaded', source: 'system', timestamp: Date.now(), version: 1, environmentIds: [] });
  }

  /**
   * Altera a norma ativa (ABNT / ASHRAE RTS / ISO 52016) e recalcula instantaneamente todas as simulações 24h.
   */
  public setStandardMode(mode: StandardMode): void {
    if (this.state.standardMode === mode && Object.keys(this.state.simulations24h).length > 0) {
      return;
    }

    this.executeTransaction('engine', 'mode_changed', this.state.environments.map(e => e.id), () => {
      this.state.standardMode = mode;
      this.recalculateAllSimulations();
    }, { mode });
  }

  /**
   * Carrega/Inicializa o projeto com uma lista de ambientes HVAC.
   */
  public loadProject(environments: HVACEnvironment[], mode: StandardMode = this.state.standardMode): void {
    this.executeTransaction('system', 'project_loaded', environments.map(e => e.id), () => {
      this.state.standardMode = mode;
      this.state.environments = environments.map(e => ({ ...e }));
      
      // Gera geometrias 2D e 3D para cada ambiente
      this.state.rooms = environments.map(e => this.convertEnvironmentToVectorRoom(e));
      this.state.walls = [];
      this.state.windows = [];
      
      // Constrói janelas e paredes 2D consolidadas
      this.state.rooms.forEach(room => {
        const env = environments.find(e => e.id === room.id);
        if (env) {
          env.windows.forEach((win, idx) => {
            const center = this.inferWindow2DCenter(room.points, win.orientation, idx, env.windows.length);
            this.state.windows.push({
              id: `win-${env.id}-${idx}`,
              center,
              length: Math.sqrt(win.area > 0 ? win.area : 1),
              height: 1.5,
              area: win.area,
              glassType: win.glassType || 'simples',
              protection: win.protection || 0.7,
              orientation: win.orientation
            });
          });
        }
      });

      // Recalcula 3D e 24h Simulações
      this.recalculateAllGeometries3D();
      this.recalculateAllSimulations();
    });
  }

  /**
   * PIPELINE 1: Atualização a partir do Canvas 2D.
   * Quando salas, paredes ou janelas são editadas no editor vetorial 2D.
   */
  public updateFromCanvas2D(
    rooms: VectorRoom[],
    walls: VectorWall[],
    windows: VectorWindow[]
  ): void {
    this.executeTransaction('canvas2d', '2d_updated', rooms.map(r => r.id), () => {
      this.state.rooms = rooms.map(r => ({ ...r, points: r.points.map(p => ({ ...p })) }));
      this.state.walls = walls.map(w => ({ ...w, p1: { ...w.p1 }, p2: { ...w.p2 } }));
      this.state.windows = windows.map(w => ({ ...w, center: { ...w.center } }));

      // 1. Converter 2D para Ambientes HVAC
      const updatedEnvs = convertVectorCanvasToHVACEnvironments(rooms, walls, windows, 2.8);

      // Preservar ID de ambiente ou mesclar propriedades não-geométricas existentes
      const mergedEnvs = updatedEnvs.map(newEnv => {
        const existing = this.state.environments.find(e => e.id === newEnv.id || e.name === newEnv.name);
        if (existing) {
          return {
            ...existing,
            area: newEnv.area,
            height: newEnv.height,
            walls: newEnv.walls,
            windows: newEnv.windows,
            roofArea: newEnv.area
          };
        }
        return newEnv;
      });

      this.state.environments = mergedEnvs;

      // 2. Atualizar Geometria 3D
      this.recalculateAllGeometries3D();

      // 3. Atualizar Simulação 24h
      this.recalculateAllSimulations();
    });
  }

  /**
   * Arraste direto de vértice de polígono 2D (FreeCAD Sketcher Node Dragging).
   * Atualiza as coordenadas do vértice e re-executa em tempo real o cálculo 3D WebGL e a simulação 24h.
   */
  public updateVertexPosition2D(
    roomId: string,
    vertexIndex: number,
    newPoint: VectorPoint
  ): void {
    const roomIndex = this.state.rooms.findIndex(r => r.id === roomId);
    if (roomIndex === -1) return;

    const room = this.state.rooms[roomIndex];
    if (vertexIndex < 0 || vertexIndex >= room.points.length) return;

    this.executeTransaction('canvas2d', '2d_updated', [roomId], () => {
      const updatedPoints = room.points.map((p, idx) => idx === vertexIndex ? { ...newPoint } : { ...p });
      const newArea = parseFloat(calculatePolygonArea(updatedPoints).toFixed(2));

      this.state.rooms[roomIndex] = {
        ...room,
        points: updatedPoints,
        area: newArea
      };

      const envIndex = this.state.environments.findIndex(e => e.id === roomId);
      if (envIndex !== -1) {
        const currentEnv = this.state.environments[envIndex];
        const side = Math.sqrt(newArea > 0 ? newArea : 1);
        const wallPerimArea = parseFloat((side * currentEnv.height).toFixed(2));

        const updatedEnv: HVACEnvironment = {
          ...currentEnv,
          area: newArea > 0 ? newArea : currentEnv.area,
          roofArea: currentEnv.hasRoof ? (newArea > 0 ? newArea : currentEnv.area) : currentEnv.roofArea,
          walls: currentEnv.walls.map(w => ({ ...w, area: wallPerimArea }))
        };

        this.state.environments[envIndex] = updatedEnv;
        this.state.geometries3D[roomId] = this.compute3DGeometry(updatedEnv);
        this.state.simulations24h[roomId] = calculateHVAC24h(updatedEnv, this.state.standardMode);
      }
    });
  }

  /**
   * PIPELINE 2: Atualização a partir da Cena 3D WebGL (HvacCadViewer.tsx).
   * Quando o usuário edita a geometria 3D (largura, comprimento, pé-direito, ou atributos do ambiente).
   */
  public updateFromScene3D(
    envId: string,
    updates: Partial<ParsedGeometry> & Partial<HVACEnvironment>
  ): void {
    const envIndex = this.state.environments.findIndex(e => e.id === envId);
    if (envIndex === -1) return;

    this.executeTransaction('scene3d', '3d_updated', [envId], () => {
      const currentEnv = this.state.environments[envIndex];

      let newArea = currentEnv.area;
      let newHeight = currentEnv.height;

      if (updates.length && updates.width) {
        newArea = parseFloat((updates.length * updates.width).toFixed(2));
      } else if (updates.area) {
        newArea = updates.area;
      }

      if (updates.height) {
        newHeight = updates.height;
      }

      const updatedEnv: HVACEnvironment = {
        ...currentEnv,
        ...updates,
        area: newArea,
        height: newHeight,
        roofArea: currentEnv.hasRoof ? newArea : currentEnv.roofArea
      };

      if (newArea !== currentEnv.area || newHeight !== currentEnv.height) {
        const side = Math.sqrt(newArea);
        const wallPerimArea = parseFloat((side * newHeight).toFixed(2));
        
        updatedEnv.walls = currentEnv.walls.map(w => ({
          ...w,
          area: wallPerimArea
        }));
      }

      this.state.environments[envIndex] = updatedEnv;

      // Sincronizar dinamicamente a Geometria 2D a partir do modelo 3D
      this.sync2DFromEnvironment(updatedEnv);

      // Recalcular Geometria 3D WebGL
      this.state.geometries3D[envId] = this.compute3DGeometry(updatedEnv);

      // Recalcular Simulação 24h
      this.state.simulations24h[envId] = calculateHVAC24h(updatedEnv, this.state.standardMode);
    });
  }

  /**
   * PIPELINE 3: Atualização a partir da Simulação de Carga Térmica 24h / Formulário de Parâmetros.
   * Quando paredes, aberturas, ocupantes, iluminação, equipamentos ou materiais mudam na simulação.
   */
  public updateFromSimulation(
    envId: string,
    updates: Partial<HVACEnvironment>
  ): void {
    const envIndex = this.state.environments.findIndex(e => e.id === envId);
    if (envIndex === -1) return;

    this.executeTransaction('simulation', 'simulation_updated', [envId], () => {
      const currentEnv = this.state.environments[envIndex];
      const updatedEnv: HVACEnvironment = {
        ...currentEnv,
        ...updates
      };

      this.state.environments[envIndex] = updatedEnv;

      // Sincronizar dinamicamente Geometria 2D
      this.sync2DFromEnvironment(updatedEnv);

      // Sincronizar Geometria 3D
      this.state.geometries3D[envId] = this.compute3DGeometry(updatedEnv);

      // Recalcular Simulação 24h
      this.state.simulations24h[envId] = calculateHVAC24h(updatedEnv, this.state.standardMode);
    });
  }

  /**
   * Atualização em Lote (Batch Update) de múltiplos ambientes com trava única de transação.
   */
  public batchUpdateEnvironments(
    environments: HVACEnvironment[],
    source: SyncSource = 'system'
  ): void {
    this.executeTransaction(source, 'full_sync', environments.map(e => e.id), () => {
      this.state.environments = environments.map(e => ({ ...e }));
      this.state.rooms = environments.map(e => this.convertEnvironmentToVectorRoom(e));
      this.recalculateAllGeometries3D();
      this.recalculateAllSimulations();
    });
  }

  /**
   * Atualiza ou insere uma janela em um ambiente mantendo sincronia paramétrica 2D/3D/24h.
   */
  public updateWindowInEnvironment(
    envId: string,
    windowIndex: number,
    updates: Partial<Window>
  ): void {
    const envIndex = this.state.environments.findIndex(e => e.id === envId);
    if (envIndex === -1) return;

    this.executeTransaction('simulation', 'simulation_updated', [envId], () => {
      const env = this.state.environments[envIndex];
      const windows = [...env.windows];
      if (windowIndex >= 0 && windowIndex < windows.length) {
        windows[windowIndex] = { ...windows[windowIndex], ...updates };
        const updatedEnv = { ...env, windows };
        this.state.environments[envIndex] = updatedEnv;
        this.sync2DFromEnvironment(updatedEnv);
        this.state.geometries3D[envId] = this.compute3DGeometry(updatedEnv);
        this.state.simulations24h[envId] = calculateHVAC24h(updatedEnv, this.state.standardMode);
      }
    });
  }

  /**
   * Atualiza lista de equipamentos elétricos de um ambiente mantendo sincronia paramétrica 2D/3D/24h.
   */
  public updateEquipmentInEnvironment(
    envId: string,
    equipmentList: Equipment[]
  ): void {
    const envIndex = this.state.environments.findIndex(e => e.id === envId);
    if (envIndex === -1) return;

    this.executeTransaction('simulation', 'simulation_updated', [envId], () => {
      const env = this.state.environments[envIndex];
      const updatedEnv = { ...env, equipment: equipmentList.map(e => ({ ...e })) };
      this.state.environments[envIndex] = updatedEnv;
      this.sync2DFromEnvironment(updatedEnv);
      this.state.geometries3D[envId] = this.compute3DGeometry(updatedEnv);
      this.state.simulations24h[envId] = calculateHVAC24h(updatedEnv, this.state.standardMode);
    });
  }

  /**
   * Sincroniza dinamicamente a geometria do Canvas 2D (pontos do polígono, paredes, janelas)
   * a partir de um `HVACEnvironment`.
   * Preserva a topologia do polígono existente escalando vértices quando a área é alterada no 3D ou simulação.
   */
  private sync2DFromEnvironment(env: HVACEnvironment): void {
    const roomIndex = this.state.rooms.findIndex(r => r.id === env.id || r.name === env.name);
    let newPoints: VectorPoint[];

    if (roomIndex !== -1 && this.state.rooms[roomIndex].points.length >= 3) {
      const currentRoom = this.state.rooms[roomIndex];
      const currentArea = calculatePolygonArea(currentRoom.points);
      if (currentArea > 0 && Math.abs(currentArea - env.area) > 0.01) {
        const scale = Math.sqrt(env.area / currentArea);
        const origin = currentRoom.points[0];
        newPoints = currentRoom.points.map(p => ({
          x: parseFloat((origin.x + (p.x - origin.x) * scale).toFixed(2)),
          y: parseFloat((origin.y + (p.y - origin.y) * scale).toFixed(2))
        }));
      } else {
        newPoints = currentRoom.points.map(p => ({ ...p }));
      }
    } else {
      const side = Math.sqrt(env.area > 0 ? env.area : 25);
      const L = parseFloat(side.toFixed(2));
      const W = parseFloat(side.toFixed(2));
      newPoints = [
        { x: 0, y: 0 },
        { x: L, y: 0 },
        { x: L, y: W },
        { x: 0, y: W }
      ];
    }

    const updatedRoom: VectorRoom = {
      id: env.id,
      name: env.name,
      points: newPoints,
      height: env.height,
      activity: env.activity,
      zonaId: env.zonaId,
      occupants: env.occupants,
      area: env.area,
      hasRoof: env.hasRoof,
      roofType: env.roofType,
      wallType: env.walls[0]?.type || 'alvenaria_leve',
      glassType: env.windows[0]?.glassType || 'simples',
      lightingWatts: env.lightingWatts,
      equipmentWatts: env.equipment.reduce((acc, eq) => acc + (eq.watts * eq.qty), 0)
    };

    if (roomIndex !== -1) {
      this.state.rooms[roomIndex] = updatedRoom;
    } else {
      this.state.rooms.push(updatedRoom);
    }

    // Sincronizar Janelas 2D para esta sala
    this.state.windows = this.state.windows.filter(w => !w.id.startsWith(`win-${env.id}`));
    env.windows.forEach((win, idx) => {
      const center = this.inferWindow2DCenter(newPoints, win.orientation, idx, env.windows.length);
      const winLength = Math.max(1.0, Math.sqrt(win.area));
      this.state.windows.push({
        id: `win-${env.id}-${idx}`,
        center,
        length: parseFloat(winLength.toFixed(2)),
        height: 1.5,
        area: win.area,
        glassType: win.glassType || 'simples',
        protection: win.protection || 0.7,
        orientation: win.orientation
      });
    });
  }

  /**
   * Converte um HVACEnvironment em um VectorRoom 2D.
   */
  private convertEnvironmentToVectorRoom(env: HVACEnvironment): VectorRoom {
    const side = Math.sqrt(env.area > 0 ? env.area : 25);
    const L = parseFloat(side.toFixed(2));
    const W = parseFloat(side.toFixed(2));

    return {
      id: env.id,
      name: env.name,
      points: [
        { x: 0, y: 0 },
        { x: L, y: 0 },
        { x: L, y: W },
        { x: 0, y: W }
      ],
      height: env.height,
      activity: env.activity,
      zonaId: env.zonaId,
      occupants: env.occupants,
      area: env.area,
      hasRoof: env.hasRoof,
      roofType: env.roofType,
      wallType: env.walls[0]?.type || 'alvenaria_leve',
      glassType: env.windows[0]?.glassType || 'simples',
      lightingWatts: env.lightingWatts,
      equipmentWatts: env.equipment.reduce((acc, eq) => acc + (eq.watts * eq.qty), 0)
    };
  }

  /**
   * Infere a posição central (X, Y em metros) no Canvas 2D para uma janela com base em sua orientação solar.
   */
  private inferWindow2DCenter(points: VectorPoint[], orientation: Orientation, index: number, total: number): VectorPoint {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const offsetFactor = (index + 1) / (total + 1);

    switch (orientation) {
      case 'sul':
        return { x: minX + (maxX - minX) * offsetFactor, y: minY };
      case 'norte':
        return { x: minX + (maxX - minX) * offsetFactor, y: maxY };
      case 'leste':
        return { x: maxX, y: minY + (maxY - minY) * offsetFactor };
      case 'oeste':
        return { x: minX, y: minY + (maxY - minY) * offsetFactor };
      default:
        return { x: centerX, y: centerY };
    }
  }

  /**
   * Calcula/Infer a ParsedGeometry 3D (length, width, height, area, volume) de um ambiente.
   */
  public compute3DGeometry(env: HVACEnvironment): ParsedGeometry {
    const side = Math.sqrt(env.area > 0 ? env.area : 25);
    const length = parseFloat(side.toFixed(2));
    const width = parseFloat(side.toFixed(2));
    const height = env.height || 2.8;
    const volume = parseFloat((env.area * height).toFixed(2));

    return {
      length,
      width,
      height,
      area: env.area,
      volume
    };
  }

  /**
   * Recalcula a geometria 3D de todos os ambientes.
   */
  private recalculateAllGeometries3D(): void {
    const geometries: Record<string, ParsedGeometry> = {};
    this.state.environments.forEach(env => {
      geometries[env.id] = this.compute3DGeometry(env);
    });
    this.state.geometries3D = geometries;
  }

  /**
   * Recalcula o perfil de carga térmica 24h para todos os ambientes de acordo com a norma ativa.
   */
  private recalculateAllSimulations(): void {
    const simulations: Record<string, HVACResult24h> = {};
    this.state.environments.forEach(env => {
      simulations[env.id] = calculateHVAC24h(env, this.state.standardMode);
    });
    this.state.simulations24h = simulations;
  }
}

/**
 * Instância Singleton Padrão do Serviço de Sincronização Paramétrica CAD.
 */
export const defaultParametricCadSyncService = new ParametricCadSyncService('ABNT');
