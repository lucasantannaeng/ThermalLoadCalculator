import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ParametricCadSyncService, 
  ParametricSyncEvent, 
  ParametricState 
} from '../services/parametricCadSyncService';
import { HVACEnvironment, StandardMode } from '../types/hvac';
import { VectorRoom, VectorWall, VectorWindow } from '../services/vectorEditorService';
import { calculateShoelaceArea as calculatePolygonArea } from '../services/cadImporterService';

describe('Parametric CAD Sync Service (FreeCAD / ForgeCAD Bidirectional Real-Time Engine)', () => {
  let syncService: ParametricCadSyncService;
  let sampleEnvironments: HVACEnvironment[];

  beforeEach(() => {
    syncService = new ParametricCadSyncService('ABNT');

    sampleEnvironments = [
      {
        id: 'env-test-1',
        name: 'Auditório Paramétrico 3D',
        area: 40,
        height: 3.0,
        occupants: 10,
        activity: 'comercial_alto',
        zonaId: 3,
        lightingWatts: 600,
        hasRoof: true,
        roofType: 'laje_isolada',
        roofArea: 40,
        walls: [
          { id: 'w1', area: 18, orientation: 'norte', type: 'alvenaria_pesada' },
          { id: 'w2', area: 18, orientation: 'sul', type: 'alvenaria_leve' }
        ],
        windows: [
          { id: 'win1', area: 5, orientation: 'norte', glassType: 'duplo', protection: 0.6 }
        ],
        equipment: [
          { id: 'eq1', name: 'Projetor 4K', watts: 400, qty: 1 }
        ]
      }
    ];
  });

  describe('1. Inicialização e Carregamento de Projeto', () => {
    it('inicializa o estado paramétrico padrão com modo ABNT', () => {
      const state = syncService.getState();
      expect(state.standardMode).toBe('ABNT');
      expect(state.version).toBe(1);
      expect(state.environments).toHaveLength(0);
    });

    it('carrega o projeto gerando geometrias 2D/3D e simulações 24h sincronizadas', () => {
      syncService.loadProject(sampleEnvironments);

      const state = syncService.getState();
      expect(state.environments).toHaveLength(1);
      expect(state.rooms).toHaveLength(1);
      expect(state.windows).toHaveLength(1);

      // Valida Geometria 3D inferida
      const geom3D = state.geometries3D['env-test-1'];
      expect(geom3D).toBeDefined();
      expect(geom3D.area).toBe(40);
      expect(geom3D.height).toBe(3.0);
      expect(geom3D.volume).toBe(120); // 40 * 3 = 120

      // Valida Simulação 24h
      const sim24h = state.simulations24h['env-test-1'];
      expect(sim24h).toBeDefined();
      expect(sim24h.standardMode).toBe('ABNT');
      expect(sim24h.hourlyProfile).toHaveLength(24);
      expect(sim24h.total).toBeGreaterThan(0);
    });
  });

  describe('2. Pipeline 2D Canvas -> 3D WebGL & Simulação 24h', () => {
    it('atualizações no Canvas 2D alteram a cena 3D e a simulação 24h em tempo real', () => {
      syncService.loadProject(sampleEnvironments);

      const listenerMock = vi.fn();
      syncService.subscribe(listenerMock);

      // Simula alteração do polígono da sala no Canvas 2D (ex: expansão para 10x10m = 100m²)
      const updatedRooms: VectorRoom[] = [
        {
          id: 'env-test-1',
          name: 'Auditório Expandido 2D',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ],
          height: 3.5,
          activity: 'comercial_alto',
          zonaId: 3,
          occupants: 15,
          hasRoof: true,
          roofType: 'laje_isolada',
          wallType: 'alvenaria_pesada',
          lightingWatts: 1500
        }
      ];

      const updatedWindows: VectorWindow[] = [
        {
          id: 'win-1',
          center: { x: 5, y: 10 },
          length: 4.0,
          height: 2.0,
          area: 8.0,
          glassType: 'duplo',
          protection: 0.5,
          orientation: 'norte'
        }
      ];

      syncService.updateFromCanvas2D(updatedRooms, [], updatedWindows);

      const state = syncService.getState();
      expect(state.lastUpdatedSource).toBe('canvas2d');

      // 1. Verifica se o HVACEnvironment foi atualizado com a área de 100m² do Canvas 2D
      const updatedEnv = state.environments.find(e => e.id === 'env-test-1');
      expect(updatedEnv).toBeDefined();
      expect(updatedEnv?.area).toBe(100);
      expect(updatedEnv?.height).toBe(3.5);

      // 2. Verifica se a Geometria 3D foi atualizada
      const geom3D = state.geometries3D['env-test-1'];
      expect(geom3D.area).toBe(100);
      expect(geom3D.height).toBe(3.5);
      expect(geom3D.volume).toBe(350); // 100 * 3.5 = 350

      // 3. Verifica se a Simulação 24h foi recalculada com o novo pico de carga
      const sim24h = state.simulations24h['env-test-1'];
      expect(sim24h.total).toBeGreaterThan(0);

      // 4. Verifica notificação de evento
      expect(listenerMock).toHaveBeenCalledTimes(1);
      const [lastState, lastEvent] = listenerMock.mock.calls[0];
      expect(lastEvent.type).toBe('2d_updated');
      expect(lastEvent.source).toBe('canvas2d');
    });
  });

  describe('3. Pipeline 3D WebGL -> 2D Canvas & Simulação 24h', () => {
    it('edição de dimensões ou altura no 3D WebGL atualiza a geometria do Canvas 2D', () => {
      syncService.loadProject(sampleEnvironments);

      const listenerMock = vi.fn();
      syncService.subscribe(listenerMock);

      // Edita dimensões 3D no visualizador (ex: novo pé-direito de 4.0m e área de 64m²)
      syncService.updateFromScene3D('env-test-1', {
        length: 8,
        width: 8,
        height: 4.0,
        area: 64
      });

      const state = syncService.getState();
      expect(state.lastUpdatedSource).toBe('scene3d');

      // 1. Verifica HVACEnvironment atualizado
      const env = state.environments[0];
      expect(env.area).toBe(64);
      expect(env.height).toBe(4.0);

      // 2. Verifica se o Polígono do Canvas 2D foi recalculado para refletir a nova dimensão
      const room2D = state.rooms[0];
      expect(room2D).toBeDefined();
      expect(room2D.points).toHaveLength(4);
      expect(room2D.points[1].x).toBe(8); // L = 8m
      expect(room2D.points[2].y).toBe(8); // W = 8m
      expect(calculatePolygonArea(room2D.points)).toBe(64);

      // 3. Verifica recalculação da Simulação 24h
      const sim24h = state.simulations24h['env-test-1'];
      expect(sim24h).toBeDefined();

      // 4. Verifica evento 3D
      expect(listenerMock).toHaveBeenCalledTimes(1);
      expect(listenerMock.mock.calls[0][1].type).toBe('3d_updated');
      expect(listenerMock.mock.calls[0][1].source).toBe('scene3d');
    });
  });

  describe('4. Pipeline Simulação 24h -> 2D Canvas & 3D WebGL', () => {
    it('edição de parâmetros na simulação atualiza o 2D e o 3D', () => {
      syncService.loadProject(sampleEnvironments);

      const listenerMock = vi.fn();
      syncService.subscribe(listenerMock);

      // Atualiza parâmetros de simulação (ex: troca tipo de vidro, área e ocupantes)
      syncService.updateFromSimulation('env-test-1', {
        occupants: 25,
        lightingWatts: 2000,
        area: 81,
        height: 3.2
      });

      const state = syncService.getState();
      expect(state.lastUpdatedSource).toBe('simulation');

      // 1. Verifica modelo 3D
      const geom3D = state.geometries3D['env-test-1'];
      expect(geom3D.area).toBe(81);
      expect(geom3D.height).toBe(3.2);

      // 2. Verifica modelo 2D
      const room2D = state.rooms[0];
      expect(room2D.occupants).toBe(25);
      expect(room2D.lightingWatts).toBe(2000);
      expect(calculatePolygonArea(room2D.points)).toBe(81);

      // 3. Verifica evento de simulação
      expect(listenerMock).toHaveBeenCalledTimes(1);
      expect(listenerMock.mock.calls[0][1].type).toBe('simulation_updated');
    });
  });

  describe('5. Alternância de Normas Técnicas (ABNT NBR 16401, ASHRAE RTS, ISO 52016)', () => {
    it('recalcula a simulação 24h em tempo real ao alterar a norma sem alterar geometrias', () => {
      syncService.loadProject(sampleEnvironments);

      const listenerMock = vi.fn();
      syncService.subscribe(listenerMock);

      // Altera norma para ASHRAE RTS
      syncService.setStandardMode('ASHRAE_RTS');

      let state = syncService.getState();
      expect(state.standardMode).toBe('ASHRAE_RTS');
      expect(state.simulations24h['env-test-1'].standardMode).toBe('ASHRAE_RTS');

      // Altera norma para ISO 52016
      syncService.setStandardMode('ISO_52016');

      state = syncService.getState();
      expect(state.standardMode).toBe('ISO_52016');
      expect(state.simulations24h['env-test-1'].standardMode).toBe('ISO_52016');

      expect(listenerMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('6. Padrão Observer & Proteção Contra Ciclos de Re-entrância', () => {
    it('permite cancelar a inscrição de um listener', () => {
      const listenerMock = vi.fn();
      const unsubscribe = syncService.subscribe(listenerMock);

      syncService.loadProject(sampleEnvironments);
      expect(listenerMock).toHaveBeenCalledTimes(1);

      unsubscribe();

      syncService.setStandardMode('ASHRAE_RTS');
      expect(listenerMock).toHaveBeenCalledTimes(1); // Não chamado novamente
    });

    it('permite cascata controlada quando um listener dispara nova sincronização após liberação do guard (Fix C3)', () => {
      syncService.loadProject(sampleEnvironments);

      let reentrantCallAttempted = false;
      const unsubscribe = syncService.subscribe((state, event) => {
        if (event.source === 'scene3d') {
          reentrantCallAttempted = true;
          // Após Fix C3, cascatas são permitidas pois notifyListeners executa após isUpdating=false
          syncService.updateFromCanvas2D([], [], []);
        }
      });

      // Dispara atualização 3D
      syncService.updateFromScene3D('env-test-1', { height: 4.5 });

      expect(reentrantCallAttempted).toBe(true);
      // O estado final reflete a cascata: canvas2d foi a última fonte de atualização
      expect(syncService.getState().lastUpdatedSource).toBe('canvas2d');

      unsubscribe();
    });
  });

  describe('7. Arraste de Vértices 2D e Propagação de Vértices em Tempo Real (FreeCAD Sketch Nodes)', () => {
    it('arraste de vértice no 2D recalcula a área, a geometria 3D e o perfil de carga térmica 24h', () => {
      syncService.loadProject(sampleEnvironments);

      // Altera o vértice 2 da sala para (10, 5) -> cálculo Shoelace resulta em área de 47.4 m²
      syncService.updateVertexPosition2D('env-test-1', 2, { x: 10, y: 5 });

      const state = syncService.getState();
      expect(state.lastUpdatedSource).toBe('canvas2d');

      const room = state.rooms[0];
      expect(room.points[2]).toEqual({ x: 10, y: 5 });
      const calculatedArea = calculatePolygonArea(room.points);
      expect(calculatedArea).toBeCloseTo(47.4, 1);

      const env = state.environments[0];
      expect(env.area).toBeCloseTo(47.4, 1);

      const geom3D = state.geometries3D['env-test-1'];
      expect(geom3D.area).toBeCloseTo(47.4, 1);

      const sim24h = state.simulations24h['env-test-1'];
      expect(sim24h).toBeDefined();
      expect(sim24h.total).toBeGreaterThan(0);
    });
  });

  describe('8. Sincronização Paramétrica de Janelas, Equipamentos e Atualizações em Lote', () => {
    it('atualiza janelas e equipamentos refletindo no 2D, 3D e simulação 24h', () => {
      syncService.loadProject(sampleEnvironments);

      syncService.updateWindowInEnvironment('env-test-1', 0, { area: 12, glassType: 'triplo' });

      let state = syncService.getState();
      const env = state.environments[0];
      expect(env.windows[0].area).toBe(12);
      expect(env.windows[0].glassType).toBe('triplo');

      const win2D = state.windows[0];
      expect(win2D.area).toBe(12);
      expect(win2D.glassType).toBe('triplo');

      syncService.updateEquipmentInEnvironment('env-test-1', [
        { id: 'eq1', name: 'Servidor Rack Industrial', watts: 1500, qty: 2 }
      ]);

      state = syncService.getState();
      expect(state.environments[0].equipment[0].watts).toBe(1500);
      expect(state.simulations24h['env-test-1'].total).toBeGreaterThan(0);
    });

    it('executa atualizações em lote (batchUpdateEnvironments) de múltiplos ambientes', () => {
      syncService.loadProject(sampleEnvironments);

      const multiEnvs: HVACEnvironment[] = [
        { ...sampleEnvironments[0], id: 'env-1', name: 'Sala 1', area: 30 },
        { ...sampleEnvironments[0], id: 'env-2', name: 'Sala 2', area: 50 }
      ];

      syncService.batchUpdateEnvironments(multiEnvs, 'system');

      const state = syncService.getState();
      expect(state.environments).toHaveLength(2);
      expect(state.rooms).toHaveLength(2);
      expect(state.geometries3D['env-1'].area).toBe(30);
      expect(state.geometries3D['env-2'].area).toBe(50);
      expect(state.simulations24h['env-1']).toBeDefined();
      expect(state.simulations24h['env-2']).toBeDefined();
    });
  });
});
